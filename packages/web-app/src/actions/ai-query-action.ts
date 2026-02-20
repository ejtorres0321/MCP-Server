"use server";

import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { DB_SCHEMA } from "@/data/db-schema";
import { getMcpClient } from "@/lib/mcp-client";
import { buildQueryMemorySummary } from "@/lib/query-memory/build-summary";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface AiQueryResult {
  success: boolean;
  data?: string;
  generatedSQL?: string;
  aiMessage?: string;
  error?: string;
  tier?: 1 | 2;
}

interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

interface McpContentItem {
  type: string;
  text?: string;
}

interface ParsedAiResponse {
  message: string | null;
  sql: string | null;
}

interface GenerateAndExecuteResult {
  generatedSQL: string | null;
  aiMessage: string | null;
  needsFullSchema: boolean;
  mcpError: string | null;
  data: string | null;
  claudeComment: string | null;
  nonRetryableError: string | null;
}

// ─── Business Rules ──────────────────────────────────────────────────────────

const BUSINESS_RULES = `
IMPORTANT BUSINESS RULES — You MUST apply these when the user's question matches these concepts:

1. SIGNED CASES ("casos firmados", "cases signed", "casos creados"):
   A case is considered "signed" ONLY when it has an invoice with a receipt (payment received).
   Join chain: cases → services (services.case_id = cases.id) → invoices (invoices.service_id = services.id) → receipt_allocations (receipt_allocations.invoice_id = invoices.id) → receipts (receipts.id = receipt_allocations.receipt_id)
   - The receipt's created_at determines WHEN the case was signed.
   - ALWAYS exclude INTAKE services: services.number NOT LIKE '%INTAKE%'
   - ALWAYS exclude cancelled records: cancelled_at IS NULL on cases, services, invoices, and receipts.

2. CASES SIGNED IN A MONTH (monthly report for Mr. Solis):
   Same as rule 1, but ALSO join contact_requests (contact_requests.person_id = cases.client_id).
   Both contact_requests.created_at AND receipts.created_at must fall in the SAME month.
   This captures the full cycle: lead came in and signed within the same month.

3. NEW NEW vs OLD NEW CLIENTS:
   - NEW NEW ("nuevo nuevo"): A client whose current case is their FIRST-EVER non-INTAKE, non-cancelled case. Check: no other cases in the cases table for this client_id where services.number NOT LIKE '%INTAKE%' AND cases.cancelled_at IS NULL with an earlier created_at.
   - OLD NEW ("viejo nuevo"): A client who HAS previous non-INTAKE, non-cancelled cases before the current one.

4. ACTIVE vs CANCELLED RECORDS:
   Many tables have a cancelled_at datetime column. If cancelled_at IS NULL the record is active. If it has a date, it is cancelled.
   Applies to: cases, services, invoices, receipts, appointments, receipt_allocations, payment_plans, fees, tasks, court_dates, deadlines, assessments.
   Unless the user specifically asks about cancelled records, ALWAYS filter cancelled_at IS NULL.

5. SERVICE STATUS:
   services.status is an ID. Join with dropdown_list_items (dropdown_list_items.id = services.status) to get the human-readable name via name_en or name_es.

6. INTAKE SERVICES:
   Identified by services.number containing 'INTAKE'. These are consultation appointments, NOT real cases.
   ALWAYS exclude when counting cases, services, or signed cases unless the user specifically asks about intakes.

7. LEADS FUNNEL (VERY IMPORTANT — use sales_funnels table, NOT CTEs with assessments):
   - ALWAYS use the sales_funnels table for funnel/conversion metrics. It has all the data in one row per lead.
   - Leads received ("leads", "leads recibidos"): COUNT DISTINCT contact_requests.person_id (deduplicate — same person calling multiple times = 1 lead).
   - Appointments booked: sales_funnels.booked_appointment_at IS NOT NULL.
   - Appointments attended ("citas asistidas"): sales_funnels.attended_appointment_at IS NOT NULL.
   - Qualified leads ("leads calificados"): sales_funnels.qualified = 1 AND sales_funnels.qualified_at IS NOT NULL.
   - Contracted / bought a case ("contratados"): sales_funnels.contracted_at IS NOT NULL.
   - Qualified but didn't buy: qualified = 1 AND qualified_at IS NOT NULL AND contracted_at IS NULL.
   - FUNNEL QUERY EXAMPLE (for a specific month — e.g., January):
     SELECT
       COUNT(DISTINCT cr.person_id) AS 'Leads Received',
       COUNT(DISTINCT CASE WHEN sf.booked_appointment_at IS NOT NULL THEN cr.person_id END) AS 'Appointments Scheduled',
       COUNT(DISTINCT CASE WHEN sf.attended_appointment_at IS NOT NULL THEN cr.person_id END) AS 'Appointments Attended',
       COUNT(DISTINCT CASE WHEN sf.qualified = 1 AND sf.qualified_at IS NOT NULL THEN cr.person_id END) AS 'Qualified',
       COUNT(DISTINCT CASE WHEN sf.contracted_at IS NOT NULL THEN cr.person_id END) AS 'Contracted'
     FROM contact_requests cr
     LEFT JOIN persons p ON cr.person_id = p.id
     LEFT JOIN sales_funnels sf ON p.sales_funnel_id = sf.id
     WHERE cr.created_at BETWEEN '2025-01-01 00:00:00' AND '2025-01-31 23:59:59'
   - This is the PREFERRED pattern for funnel queries. It is simple, fast, and uses a single query.
   - Do NOT use assessments.qualified_at — assessments does NOT have a qualified_at column. Use sales_funnels instead.

8. SALES FUNNEL TABLE (sales_funnels):
   - persons.sales_funnel_id → sales_funnels.id
   - booked_appointment_at = appointment was scheduled
   - attended_appointment_at = person showed up
   - initial_contract_value = total contract value
   - initial_payments_received = down payment amount
   - sales_funnels.campaign_id → campaigns.id (marketing campaign)
   - sales_funnels.contacted_by → users.id (who made first contact)
   - sales_funnels.assisted_by → users.id (who assisted at appointment)
   - Use this table for appointment metrics, conversion rates, revenue summaries.
   - MARKETING SOURCE for signed cases: contact_requests → persons (person_id) → cases (client_id) → invoices. The contact_request has utm_source, utm_medium, campaign fields.

9. ASSESSMENTS / CONTRACTED CLIENTS ("contratados", "contracted", "clientes que contrataron"):
    - assessments table = intake evaluation of a potential client by an attorney.
    - assessments.person_id → persons.id, assessments.office_id → offices.id, assessments.attorney_id → users.id.
    - assessments.contracted_at = date the person signed a contract. If NOT NULL, the person contracted.
    - assessments.service_type_id → service_types.id (what type of service was evaluated).
    - assessments.cancelled_at = assessment was cancelled.
    - services.assessment_id → assessments.id (links the resulting service back to the assessment).
    - DEFAULT INTERPRETATION: When user asks "people who contacted in [period] and contracted" or "leads from [period] that contracted",
      the DEFAULT meaning is: contacted in that period AND contracted AT ANY TIME (a.contracted_at IS NOT NULL).
      Example SQL:
      SELECT CONVERT_TZ(p.created_at, 'UTC', p.timezone) AS 'Client created at',
        CONCAT(p.first_name, ' ', IFNULL(p.middle_name, ''), ' ', p.last_name) AS 'Client',
        IFNULL(p.legacy_client_number, CONCAT(p.number_prefix, '-', p.number_suffix)) AS 'Client number',
        CONVERT_TZ(a.contracted_at, 'UTC', p.timezone) AS 'Signed date'
      FROM contact_requests cr
      JOIN persons p ON cr.person_id = p.id
      JOIN assessments a ON a.person_id = p.id
      WHERE a.contracted_at IS NOT NULL
        AND cr.created_at BETWEEN '2025-12-01 00:00:00' AND '2025-12-31 23:59:59'
      ORDER BY cr.created_at ASC
      LIMIT 1000
    - ONLY filter a.contracted_at within the same date range if the user EXPLICITLY says "contacted AND contracted IN [period]"
      (e.g., "contacted and contracted both in December", "contacted in December and also signed in December").
      If the user does NOT explicitly say the contracted date must also be in the period, use the DEFAULT interpretation above.

10. INVOICES & BILLING ("financials", "finanzas"):
    - Invoice balance = invoices.amount - invoices.paid (how much the client still owes).
    - invoices.payment_plan_id links to payment_plans table when a client is on a payment plan.
    - payment_plans.status indicates plan health: 'late', 'current', 'completed', etc.
    - When user asks for financials, always return: SUM of invoices (amount), SUM of receipts (amount), and balance for the date range.
    - To find the LAST payment received for an invoice, get the most recent non-cancelled receipt_allocation:
      Use ROW_NUMBER() OVER (PARTITION BY ra.invoice_id ORDER BY ra.created_at DESC) to get rownumber=1.
    - ALWAYS use CONVERT_TZ(datetime_col, 'UTC', table.timezone) when displaying dates to the user. Dates are stored in UTC.

11. IOLTA / TRUST ACCOUNTS ("cuentas IOLTA", "fees disponibles", "trust balance"):
    - The fees table tracks trust/IOLTA money per service: fees.service_id → services.id.
    - fees.available = money available in the trust account for that service.
    - fees.withdrawn = money already withdrawn.
    - fees.paid_not_deposited = received but not yet deposited.
    - To find IOLTA accounts with balance and late payment plans:
      Join: invoices → payment_plans (pp.id = i.payment_plan_id) → services → cases → persons → offices
      Subquery: SUM fees.available grouped by service_id, filter available > 0.
      Filter: payment_plans.status = 'late', invoices.cancelled_at IS NULL.

12. SEARCHING BY CASE NUMBER:
    When user asks for a case by case number, ALWAYS use LIKE instead of = because users often provide partial numbers.
    Example: WHERE c.number LIKE '%242504%' (NOT c.number = '242504').
    Same for searching by client name: WHERE p.first_name LIKE '%name%' OR p.last_name LIKE '%name%'.

13. CLIENT NUMBER FORMAT:
    Display client number as: IFNULL(persons.legacy_client_number, CONCAT(persons.number_prefix, '-', persons.number_suffix)).
    Use this whenever showing a "client number" or "numero de cliente".

14. CLIENT FULL NAME:
    Display as: CONCAT(p.first_name, ' ', IFNULL(p.middle_name, ''), ' ', p.last_name).
    Use this whenever showing a client name.

15. BOS URL (VERY IMPORTANT — always include when listing persons/clients):
    Generate a clickable link to the person's profile: CONCAT('https://bos.manuelsolis.com/persons/', p.id) AS URL.
    This URL does NOT exist in the database — it is built by concatenating the base URL with persons.id.
    ALWAYS include this column in results that list clients or persons so the user can verify the data in BOS.

16. SERVICE TYPES:
    - service_types table defines the type of immigration service (e.g., ROI, asylum, citizenship).
    - services.service_type_id → service_types.id.
    - service_types.name = the human-readable service type name.
    - service_types.case_type = the case category.
    - When filtering by a specific service type by name, join service_types and filter on service_types.name.

17. PHONE NUMBERS:
    - phones table stores phone numbers per person: phones.person_id → persons.id.
    - A person can have multiple phones. To get just ONE phone, use ROW_NUMBER() OVER (PARTITION BY ph.person_id ORDER BY ph.created_at) and filter rn = 1.
    - phones.e164 = phone in E.164 international format (preferred for display).
    - phones.primary = 1 indicates the primary phone number.

18. USERS / STAFF / ATTORNEYS:
    - users table = firm employees (attorneys, paralegals, staff).
    - cases.attorney_id → users.id (the attorney on the case).
    - cases.assigned_to → users.id (paralegal/staff assigned).
    - services.assigned_to → users.id, services.attorney_assigned_to → users.id.
    - Display staff name: CONCAT(u.first_name, ' ', u.last_name).
    - users.active = 1 for current employees. users.role indicates their role.

19. COURT DATES & DEADLINES:
    - court_dates: service court hearings. court_dates.service_id → services.id, court_dates.court_id → courts.id, court_dates.judge_id → judges.id.
    - court_dates.due_at = hearing date. court_dates.type → dropdown_list_items.id for hearing type.
    - deadlines: service deadlines/tasks. deadlines.service_id → services.id, deadlines.person_id → persons.id.
    - deadlines.due_at = due date, deadlines.completed_at = when completed (NULL = still pending).
    - Pending deadlines: WHERE deadlines.completed_at IS NULL AND deadlines.cancelled_at IS NULL AND deadlines.due_at >= CURDATE().

20. CLIENT COMMUNICATIONS:
    - sms: text messages. sms.person_id → persons.id. Content in sms.content, date in sms.created_at.
    - comments: polymorphic notes on any entity. comments.commentable_type + comments.commentable_id.
      For case comments: commentable_type contains 'Case'. comments.critical = 1 for important notes.
    - call_records: phone call logs. call_records.person_id → persons.id, call_records.service_id → services.id.

21. TASKS:
    - tasks: polymorphic tasks assigned to staff. tasks.parent_type + tasks.parent_id (the entity the task belongs to).
    - tasks.assigned_to → users.id, tasks.completed_at = when done (NULL = incomplete), tasks.due_at = deadline.
    - Incomplete tasks: WHERE tasks.completed_at IS NULL AND tasks.cancelled_at IS NULL.

22. DOCUMENTS:
    - documents: polymorphic file attachments. documents.parent_type + documents.parent_id OR documents.documentable_type + documents.documentable_id.
    - documents.original_filename = file name, documents.description = document description.

23. POLYMORPHIC RELATIONSHIPS:
    Several tables use polymorphic joins (parent_type + parent_id, commentable_type + commentable_id, documentable_type + documentable_id).
    The type column contains the Laravel model class name, e.g. 'App\\Models\\Case', 'App\\Models\\Service'.
    When filtering, use LIKE: WHERE parent_type LIKE '%Case%'.

24. COMPLEX QUERIES — USE CTEs:
    For complex reports that need multiple derived tables or subqueries, use MySQL CTEs (WITH ... AS syntax).
    Example patterns:
    - WITH svc AS (SELECT ... FROM services JOIN ...) SELECT ... FROM svc
    - WITH one_phone AS (SELECT *, ROW_NUMBER() OVER (...) AS rn FROM phones) SELECT ... FROM one_phone WHERE rn = 1
    CTEs make queries more readable and are fully supported.

25. KEY RELATIONSHIPS:
    - cases.client_id → persons.id (the client — NEVER use persons.person_id)
    - cases.attorney_id → users.id
    - cases.assigned_to → users.id
    - services.case_id → cases.id
    - services.person_id → persons.id
    - services.service_type_id → service_types.id
    - services.assessment_id → assessments.id
    - services.assigned_to → users.id
    - assessments.person_id → persons.id
    - assessments.attorney_id → users.id
    - assessments.service_type_id → service_types.id
    - invoices.service_id → services.id
    - invoices.person_id → persons.id
    - invoices.payment_plan_id → payment_plans.id
    - receipt_allocations.invoice_id → invoices.id
    - receipt_allocations.receipt_id → receipts.id
    - fees.service_id → services.id
    - phones.person_id → persons.id
    - persons.office_id → offices.id
    - persons.sales_funnel_id → sales_funnels.id
    - contact_requests.person_id → persons.id
    - appointments.person_id → persons.id
    - sales_funnels.campaign_id → campaigns.id
    - sales_funnels.contacted_by → users.id
    - court_dates.service_id → services.id
    - court_dates.court_id → courts.id
    - court_dates.judge_id → judges.id
    - deadlines.service_id → services.id
    - deadlines.person_id → persons.id
    - sms.person_id → persons.id
    - tasks — polymorphic: parent_type + parent_id
    - comments — polymorphic: commentable_type + commentable_id
    - documents — polymorphic: parent_type + parent_id OR documentable_type + documentable_id
    - services.status → dropdown_list_items.id
    - court_dates.type → dropdown_list_items.id
`;

// ─── Core Schema (27 most-used tables — covers ~99% of queries) ──────────────
// Copied from db-schema.ts. Update if columns change in the database.

const CORE_SCHEMA = `Database: bos
Core Tables:
cases(id,created_at,updated_at,timezone,number,office_id,type,created_by,last_status_review_comment_id,assigned_to,attorney_id,legacy_id,persons_check_required,legacy_client_number,preference,legacy_consulnum,cancelled_at,client_id,client_relationship_to_case,dependent_person_id,dependent_person_relationship_to_case,dependent_person_relationship_to_client,client_location,notice_to_appear,nvc_invoice_number,legacy_relationship_to_case,lr_lead_id)
services(id,created_at,updated_at,timezone,number,created_by,case_id,service_type_id,status,status_updated_at,status_updated_by,next_review_at,critical_review,next_step,active,is_sijs,expires_at,expiry_chase_started_at,do_expiry_chase,status_comment,cancelled_at,legacy_id,assessment_id,check_required,cost_covered_by_roi,assigned_to,attorney_assigned_to,no_primary_attorney_assigned_to,no_primary_attorney_assigned_at,assigned_at,attorney_assigned_at,out_state,other_attorney,other_attorney_non_primary,attorney_name,attorney_name_non_primary,attorney_contract_date,urgent,deport_contract,asylum_alone_or_family,have_nta,nta_date,link_nta,nta_notes,attorney_cost,attorney_comment,detained,status_milestone_report,person_id_changes_status_report,erop_status,clickup_task_id,need_appointments,parents_dead)
assessments(id,created_at,updated_at,number,person_id,office_id,created_by,attorney_id,service_type_id,type,status,contracted_at,timezone,case_type,reason_for_not_contracting_today,cancelled_at)
service_types(id,created_at,updated_at,legacy_id,active,name,case_type,editable,id_in_code,expires,reporting_group,en_contract_printable_id,en_payment_plan_contract_printable_id,es_contract_printable_id,es_payment_plan_contract_printable_id,limit_deadline)
invoices(id,created_at,updated_at,timezone,created_by,office_id,service_id,number,status,paid_at,amount,paid,cancelled_at,person_id,original_amount,payment_plan_id,new_client,balance_in_oracle)
receipts(id,created_at,updated_at,timezone,created_by,office_id,payment_method,payment_number,number,amount,cancelled_at,paid_by,reference,type)
receipt_allocations(id,created_at,updated_at,receipt_id,invoice_id,installment_id,amount,cancelled_at,payment_collection_activity_id)
payment_plans(id,created_at,updated_at,timezone,created_by,office_id,status,cancelled_at,person_id,needs_review,invoice_balance,installment_balance)
fees(id,created_at,updated_at,timezone,created_by,service_id,name,amount,paid,status,cancelled_at,withdrawn,available,paid_not_deposited,import_hash)
persons(id,created_at,updated_at,office_id,legacy_client_number,locale,first_name,middle_name,last_name,born_at,country_of_birth,occupation,email,alien_number,social_security_number,immigration_status,drivers_licence,address_1,address_2,city,state,zip,country,search,county,employer,timezone,postal_address_1,postal_address_2,postal_city,postal_county,postal_state,postal_zip,postal_country,number_prefix,number_suffix,died_at,check_required,sales_funnel_id,confirmation_number,marital_status,police_record_count,police_record_data,police_record,military_service,army,passport_number,immigration_status_granted_at,immigration_status_expires_at,checked_for_duplicates_after_import,alias_first_name,alias_middle_name,alias_last_name,second_alien_number,cerenade_client_id,added_to_cerenade_at,sex,pronouns,citizenship,city_of_birth,state_of_birth,maiden_name,preferred_name,nvc_case_number,nvc_invoice_id,has_roi,temp,failed_birthdate_attempts,lr_intake_id,comment_created,autopay,desactivate_autopay_by,second_email,address_updated)
phones(id,created_at,updated_at,person_id,number,content,mobile,country,e164,primary,error)
users(id,email,first_name,last_name,role,active,office_id,department,number,locale,timezone,created_at,updated_at)
contact_requests(id,created_at,updated_at,timezone,campaign_id,channel_id,office_id,person_id,assigned_to,completed_at,contact_method,first_name,last_name,email,phone,content,facebook_event_id,locale,source_url,utm_content,utm_medium,utm_source,utm_campaign,utm_term,active,spam,existing_client,spoke_to_client_at,call_rail_tracking_number_id,postal_zip,alien_number,country,client_name,opener_assigned_to,last_status,no_combo,campaign,last_contact_attemp,external_id,source_name,source,tracking_phone_number,call_rail_resource_id,office_distance,sent_to_webhook,accepted_terms,marketing_consent)
appointments(id,created_at,updated_at,office_id,calendar_id,person_id,start_at,duration,confirmation_number,sms,locked,attended,timezone,type,source,visit_id,content,comment_type_call_id,payment_required,department,no_show_follow_up_complete,created_by,appointment_type_id,cancelled_at,service_id,task_tracking_id,milestone_id,original_appointment_id)
sales_funnels(id,created_at,updated_at,timezone,campaign_id,contact_method,source_url,utm_source,utm_medium,utm_term,utm_content,contacted_by,reason_for_not_wanting_appointment,booked_appointment_at,attended_appointment_at,assisted_by,qualified_at,qualified,contracted_at,initial_contract_value,initial_payments_received,appointment_start_at,office_id)
campaigns(id,created_at,updated_at,source,source_id,name,description,active,language)
court_dates(id,created_at,updated_at,timezone,created_by,office_id,service_id,court_id,judge_id,type,due_at,attorney_id,letter_sent_at,client_conference_at,result,result_set_at,cancelled_at,person_id,room,webex_link)
courts(id,created_at,updated_at,timezone,active,name,address,id_in_code)
judges(id,created_at,updated_at,court_id,name,active)
deadlines(id,created_at,updated_at,timezone,created_by,office_id,service_id,person_id,due_at,type,content,completed_at,cancelled_at,assigned_to,attorney_id,court_date_id,result,receipt_number)
tasks(id,created_at,updated_at,timezone,created_by,assigned_to,office_id,parent_id,parent_type,taskable_id,taskable_type,due_at,completed_at,type_text,content,priority,completed_by,type,cancelled_at)
sms(id,created_at,updated_at,created_by,person_id,service_id,phone_id,content,sent_at,delivered_at,error,number,timezone)
comments(id,created_at,updated_at,timezone,created_by,parent_id,parent_type,commentable_id,commentable_type,number,content,critical,type)
documents(id,created_at,updated_at,timezone,created_by,documentable_id,documentable_type,type,number,description,original_filename,filename,source,parent_id,parent_type)
call_records(id,created_at,updated_at,timezone,created_by,person_id,service_id,office_id,assigned_to,department,phone_number,type,typecall,question,answer,call_status)
visits(id,created_at,updated_at,timezone,office_id,person_id,created_by,attended_by,appointment_id,department,type,status,attended_at,ended_at,cancelled_at,content)
dropdown_list_items(id,dropdown_list_id,name_en,name_es,active,locked,created_at,updated_at,id_in_code)
dropdown_lists(id,name,active,created_at,updated_at,id_in_code,can_add_new_items)
offices(id,created_at,updated_at,name,offices_id,address_1,address_2,city,state,zip,phone,email,timezone,active,legacy_id,english_opening_hours,spanish_opening_hours,postal_address,prefix,calendar_outlook,location_maps)`;

// ─── System Prompt Templates ─────────────────────────────────────────────────

const DATA_ANALYST_RULES = `You are a data analyst for a MySQL database used by an immigration law firm (Manuel Solis & Associates). You help the firm's management understand their data through natural language conversations.

YOUR RESPONSE FORMAT — You MUST always use these XML tags in your response:

<message>Your text commentary, analysis, or question goes here. This is shown directly to the user in a chat conversation.</message>
<sql>The SQL query goes here (if any). Raw SQL only — no markdown, no code fences, no semicolons.</sql>

RULES:
1. ALWAYS include a <message> tag with a helpful response to the user.
2. Include a <sql> tag ONLY when you need to query the database. If the user is asking a clarification, chatting, or you need more information, respond with ONLY a <message> tag and NO <sql> tag.
3. When generating SQL: only valid MySQL read-only queries (SELECT or WITH ... SELECT). Never generate INSERT, UPDATE, DELETE, DROP, ALTER, CREATE.
4. Always include a LIMIT clause (max 1000 rows) unless the user specifically asks for a count or aggregate.
5. Use proper MySQL syntax. You MAY use CTEs (WITH ... AS), window functions (ROW_NUMBER, PARTITION BY), subqueries, and any standard MySQL read features.
6. The user may write in Spanish or English. ALWAYS respond in the SAME LANGUAGE the user used.
7. Use the exact column and table names from the schema below. Do not guess or invent names.
8. When the user mentions a table or column name that is close but not exact, use the closest matching name from the schema.
9. CRITICAL: Always apply the BUSINESS RULES below. They define how this firm interprets common terms like "signed cases", "new clients", "leads", etc.
10. Do NOT end SQL queries with a semicolon.
11. Keep your <message> concise but helpful — 1-3 sentences for simple queries, more for complex analysis requests.
12. When the user's request is ambiguous, ask for clarification in <message> without generating SQL.`;

const TIER1_SYSTEM_PROMPT = `${DATA_ANALYST_RULES}
13. SCHEMA LIMITATION: You only have the core tables listed below. If the user's question requires a table NOT listed in the schema, DO NOT guess. Instead, respond with: <message>NEED_FULL_SCHEMA: looking for table about [description]</message>

{QUERY_MEMORY}

{BUSINESS_RULES}

DATABASE SCHEMA (core tables only):
{CORE_SCHEMA}`;

const TIER2_SYSTEM_PROMPT = `${DATA_ANALYST_RULES}

PREVIOUS ATTEMPT CONTEXT:
A previous query attempt with a limited schema failed.
Generated SQL: {FAILED_SQL}
Error: {ERROR_MESSAGE}
Please generate a corrected query using the COMPLETE schema below.

{QUERY_MEMORY}

{BUSINESS_RULES}

DATABASE SCHEMA (all tables):
{SCHEMA}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NEED_FULL_SCHEMA_PATTERN = /NEED_FULL_SCHEMA:/i;

function parseAiResponse(raw: string): ParsedAiResponse {
  const messageMatch = raw.match(/<message>([\s\S]*?)<\/message>/i);
  const sqlMatch = raw.match(/<sql>([\s\S]*?)<\/sql>/i);
  return {
    message: messageMatch ? messageMatch[1].trim() : null,
    sql: sqlMatch ? sqlMatch[1].trim() : null,
  };
}

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return String(content ?? "");
  return (content as McpContentItem[])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text!)
    .join("\n");
}

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id || !session.user.mfaVerified || !session.user.isApproved) {
    throw new Error("Unauthorized");
  }
  return session;
}

/**
 * Calls Claude to generate a response (text + optional SQL), validates it, and executes via MCP.
 * Accepts conversation history for multi-turn context.
 * Returns a structured result so the caller can decide whether to retry.
 */
async function generateAndExecuteSQL(
  anthropic: Anthropic,
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<GenerateAndExecuteResult> {
  // 1. Call Claude
  const t0 = Date.now();
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });
  console.log(`[AI Query]   Claude API: ${Date.now() - t0}ms`);

  // 2. Extract raw text
  const rawResponse = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (!rawResponse) {
    return {
      generatedSQL: null,
      aiMessage: null,
      needsFullSchema: false,
      mcpError: null,
      data: null,
      claudeComment: "AI could not generate a response",
      nonRetryableError: "AI could not generate a response",
    };
  }

  // 3. Parse XML response
  const parsed = parseAiResponse(rawResponse);

  // Fallback: if Claude ignores XML format and returns raw SQL
  if (!parsed.message && !parsed.sql) {
    parsed.sql = rawResponse;
  }

  const aiMessage = parsed.message;
  let generatedSQL = parsed.sql;

  // 4. Text-only response (no SQL needed — clarification, greeting, etc.)
  if (!generatedSQL) {
    // Check if it's a NEED_FULL_SCHEMA signal
    if (aiMessage && NEED_FULL_SCHEMA_PATTERN.test(aiMessage)) {
      return {
        generatedSQL: null,
        aiMessage,
        needsFullSchema: true,
        mcpError: null,
        data: null,
        claudeComment: aiMessage,
        nonRetryableError: null,
      };
    }

    return {
      generatedSQL: null,
      aiMessage,
      needsFullSchema: false,
      mcpError: null,
      data: null,
      claudeComment: null,
      nonRetryableError: null,
    };
  }

  // 5. Strip markdown code fences (safety — in case Claude wraps SQL despite instructions)
  generatedSQL = generatedSQL
    .replace(/^```(?:sql)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  // 6. Strip trailing semicolons (MCP validator rejects them as "multiple statements")
  generatedSQL = generatedSQL.replace(/;\s*$/, "").trim();

  // 7. Check if only comments remain
  const strippedSQL = generatedSQL.replace(/^--.*$/gm, "").trim();
  if (!strippedSQL) {
    return {
      generatedSQL,
      aiMessage,
      needsFullSchema: false,
      mcpError: null,
      data: null,
      claudeComment: generatedSQL,
      nonRetryableError: null,
    };
  }

  // 8. Safety: SELECT or WITH (CTE) only (non-retryable)
  const firstWord = strippedSQL.split(/\s+/)[0]?.toUpperCase();
  if (firstWord !== "SELECT" && firstWord !== "WITH") {
    return {
      generatedSQL,
      aiMessage,
      needsFullSchema: false,
      mcpError: null,
      data: null,
      claudeComment: null,
      nonRetryableError: "Only SELECT queries are permitted for safety",
    };
  }

  console.log("[AI Query]   Generated SQL:", generatedSQL);

  // 9. Execute via MCP
  const client = await getMcpClient();
  const t1 = Date.now();
  const result = await client.callTool({
    name: "query_database",
    arguments: { sql: generatedSQL },
  });
  console.log(`[AI Query]   MCP query: ${Date.now() - t1}ms`);

  if (result.isError) {
    return {
      generatedSQL,
      aiMessage,
      needsFullSchema: false,
      mcpError: extractText(result.content),
      data: null,
      claudeComment: null,
      nonRetryableError: null,
    };
  }

  return {
    generatedSQL,
    aiMessage,
    needsFullSchema: false,
    mcpError: null,
    data: extractText(result.content),
    claudeComment: null,
    nonRetryableError: null,
  };
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export async function executeNaturalLanguageQuery(
  prompt: string,
  conversationHistory: ConversationTurn[] = []
): Promise<AiQueryResult> {
  try {
    await requireAuth();

    if (!prompt.trim()) {
      return { success: false, error: "Please enter a question" };
    }

    if (prompt.trim().length > 2000) {
      return { success: false, error: "Question is too long (max 2000 characters)" };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your-anthropic-api-key-here") {
      return { success: false, error: "AI service is not configured. Please set ANTHROPIC_API_KEY in .env.local" };
    }

    const anthropic = new Anthropic({ apiKey });

    // Build messages array with conversation history + current prompt
    // Keep last 10 turns to avoid token overflow while maintaining context
    const recentHistory = conversationHistory.slice(-10);
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...recentHistory,
      { role: "user" as const, content: prompt.trim() },
    ];

    // Build query memory summary (cached, fast)
    const queryMemorySummary = await buildQueryMemorySummary();

    // ── Tier 1: Core schema (fast, cheap) ──────────────────────────────────
    const tier1SystemPrompt = TIER1_SYSTEM_PROMPT
      .replace("{QUERY_MEMORY}", queryMemorySummary)
      .replace("{BUSINESS_RULES}", BUSINESS_RULES)
      .replace("{CORE_SCHEMA}", CORE_SCHEMA);

    console.log("[AI Query] Starting Tier 1 (core schema) —", messages.length, "messages");
    const t0 = Date.now();
    const tier1 = await generateAndExecuteSQL(anthropic, tier1SystemPrompt, messages);
    console.log(`[AI Query] Tier 1 completed: ${Date.now() - t0}ms`);

    // Tier 1 succeeded with data
    if (tier1.data !== null) {
      console.log("[AI Query] Tier 1 SUCCESS — data size:", tier1.data.length, "chars");
      return {
        success: true,
        data: tier1.data,
        generatedSQL: tier1.generatedSQL ?? undefined,
        aiMessage: tier1.aiMessage ?? undefined,
        tier: 1,
      };
    }

    // Text-only response (no SQL, no error — just a conversational message)
    if (!tier1.generatedSQL && tier1.aiMessage && !tier1.mcpError && !tier1.nonRetryableError && !tier1.needsFullSchema) {
      console.log("[AI Query] Tier 1 TEXT-ONLY response");
      return {
        success: true,
        aiMessage: tier1.aiMessage,
        tier: 1,
      };
    }

    // Non-retryable error (e.g. non-SELECT query) — don't fallback
    if (tier1.nonRetryableError) {
      return {
        success: false,
        error: tier1.nonRetryableError,
        generatedSQL: tier1.generatedSQL ?? undefined,
        aiMessage: tier1.aiMessage ?? undefined,
        tier: 1,
      };
    }

    // ── Tier 2: Full schema (fallback) ─────────────────────────────────────
    if (tier1.needsFullSchema || tier1.mcpError) {
      const failReason = tier1.needsFullSchema
        ? `Claude requested full schema: ${tier1.claudeComment}`
        : `SQL execution error: ${tier1.mcpError}`;
      console.log(`[AI Query] Tier 1 FALLBACK → Tier 2: ${failReason}`);

      const tier2SystemPrompt = TIER2_SYSTEM_PROMPT
        .replace("{QUERY_MEMORY}", queryMemorySummary)
        .replace("{BUSINESS_RULES}", BUSINESS_RULES)
        .replace("{SCHEMA}", DB_SCHEMA)
        .replace("{FAILED_SQL}", tier1.generatedSQL || "N/A")
        .replace("{ERROR_MESSAGE}", tier1.mcpError || tier1.claudeComment || "Table not found in core schema");

      const t1 = Date.now();
      const tier2 = await generateAndExecuteSQL(anthropic, tier2SystemPrompt, messages);
      console.log(`[AI Query] Tier 2 completed: ${Date.now() - t1}ms (total: ${Date.now() - t0}ms)`);

      if (tier2.data !== null) {
        console.log("[AI Query] Tier 2 SUCCESS — data size:", tier2.data.length, "chars");
        return {
          success: true,
          data: tier2.data,
          generatedSQL: tier2.generatedSQL ?? undefined,
          aiMessage: tier2.aiMessage ?? undefined,
          tier: 2,
        };
      }

      // Text-only response from Tier 2
      if (!tier2.generatedSQL && tier2.aiMessage && !tier2.mcpError && !tier2.nonRetryableError) {
        return {
          success: true,
          aiMessage: tier2.aiMessage,
          tier: 2,
        };
      }

      // Tier 2 also failed
      return {
        success: false,
        error: tier2.mcpError || tier2.nonRetryableError || tier2.claudeComment || "Query failed after retry",
        generatedSQL: tier2.generatedSQL ?? undefined,
        aiMessage: tier2.aiMessage ?? undefined,
        tier: 2,
      };
    }

    // Claude returned only comments (no NEED_FULL_SCHEMA) — informational, not retryable
    return {
      success: false,
      error: tier1.claudeComment || "AI could not generate a query",
      generatedSQL: tier1.generatedSQL ?? undefined,
      aiMessage: tier1.aiMessage ?? undefined,
      tier: 1,
    };
  } catch (error) {
    console.error("[AI Query] error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

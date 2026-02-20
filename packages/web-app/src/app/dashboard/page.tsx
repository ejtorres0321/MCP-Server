import { DashboardProvider } from "@/context/dashboard-context";
import { ConversationPanel } from "@/components/dashboard/conversation-panel";
import { ResultsPanel } from "@/components/dashboard/results-panel";

export default function DashboardPage() {
  return (
    <DashboardProvider>
      <div className="flex h-full w-full flex-col lg:flex-row">
        {/* Left column: conversation */}
        <div className="h-1/2 flex-shrink-0 lg:h-full lg:w-4/12 lg:min-w-[320px]">
          <ConversationPanel />
        </div>
        {/* Right column: results */}
        <div className="h-1/2 flex-1 lg:h-full lg:w-8/12">
          <ResultsPanel />
        </div>
      </div>
    </DashboardProvider>
  );
}

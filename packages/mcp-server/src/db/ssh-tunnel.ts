import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { Client } from 'ssh2';
import type { Env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let sshClient: Client | null = null;
let localServer: Server | null = null;

export interface TunnelInfo {
  localHost: string;
  localPort: number;
}

export async function createSshTunnel(config: Env): Promise<TunnelInfo> {
  if (!config.SSH_HOST) throw new Error('SSH_HOST is required when SSH_ENABLED=true');
  if (!config.SSH_USER) throw new Error('SSH_USER is required when SSH_ENABLED=true');
  if (!config.SSH_KEY_PATH) throw new Error('SSH_KEY_PATH is required when SSH_ENABLED=true');

  const privateKey = readFileSync(config.SSH_KEY_PATH);

  return new Promise<TunnelInfo>((resolve, reject) => {
    sshClient = new Client();

    sshClient.on('ready', () => {
      logger.info('SSH connection established', {
        host: config.SSH_HOST,
        user: config.SSH_USER,
      });

      localServer = createServer((localSocket) => {
        sshClient!.forwardOut(
          '127.0.0.1',
          0,
          config.DB_HOST,
          config.DB_PORT,
          (err, stream) => {
            if (err) {
              logger.error('SSH forwardOut failed', { error: err.message });
              localSocket.end();
              return;
            }

            localSocket.pipe(stream);
            stream.pipe(localSocket);

            stream.on('close', () => localSocket.end());
            localSocket.on('close', () => stream.end());

            stream.on('error', (e: Error) => {
              logger.error('SSH stream error', { error: e.message });
              localSocket.end();
            });

            localSocket.on('error', (e: Error) => {
              logger.error('Local socket error', { error: e.message });
              stream.end();
            });
          },
        );
      });

      localServer!.on('error', (err) => {
        logger.error('Local tunnel server error', { error: err.message });
        reject(err);
      });

      localServer!.listen(config.SSH_LOCAL_PORT, '127.0.0.1', () => {
        const tunnelInfo: TunnelInfo = {
          localHost: '127.0.0.1',
          localPort: config.SSH_LOCAL_PORT,
        };
        logger.info('SSH tunnel listening', tunnelInfo);
        resolve(tunnelInfo);
      });
    });

    sshClient.on('error', (err) => {
      logger.error('SSH connection error', { error: err.message });
      reject(new Error(`SSH connection failed: ${err.message}`));
    });

    sshClient.on('close', () => {
      logger.warn('SSH connection closed');
    });

    sshClient.connect({
      host: config.SSH_HOST,
      port: config.SSH_PORT,
      username: config.SSH_USER,
      privateKey,
      passphrase: config.SSH_KEY_PASSPHRASE || undefined,
      keepaliveInterval: 10000,
      keepaliveCountMax: 3,
      readyTimeout: 20000,
    });
  });
}

export async function closeSshTunnel(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (localServer) {
      localServer.close(() => {
        logger.info('Local tunnel server closed');
        localServer = null;

        if (sshClient) {
          sshClient.end();
          sshClient = null;
          logger.info('SSH client disconnected');
        }
        resolve();
      });
    } else if (sshClient) {
      sshClient.end();
      sshClient = null;
      logger.info('SSH client disconnected');
      resolve();
    } else {
      resolve();
    }
  });
}

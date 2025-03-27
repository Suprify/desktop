// global.d.ts
interface Window {
    electronAPI: {
        getMachineName(): string;
        generateAccessToken(): string;
        onAppInfoReceived(arg0: (event: any, { version, author }: { version: any; author: any; }) => void): unknown;
        getSnmpData(ip: string, oid: string, community: string): unknown;
        on: (channel: string, listener: (...args: any[]) => void) => void;
        removeAllListeners: (channel: string) => void;
        send: (channel: string, data: any) => void;
    };
}

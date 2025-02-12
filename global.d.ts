// global.d.ts
interface Window {
    electronAPI: {
        getMachineName(): string;
        generateAccessToken(): string;
        onAppInfoReceived(arg0: (event: any, { version, author }: { version: any; author: any; }) => void): unknown;
        getSnmpData(printer_ip: number, snmp_oid_copy_count: string, snmp_oid_community: string): unknown;
        on: (channel: string, listener: (...args: any[]) => void) => void;
        removeAllListeners: (channel: string) => void;
        send: (channel: string, data: any) => void;
    };
}

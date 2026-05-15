export declare function setQR(qr: string | null): void;
export declare function setStatus(status: string): void;
export declare function setSendFn(fn: (jid: string, text: string) => Promise<void>): void;
export declare function setResetFn(fn: () => Promise<void>): void;
export declare function startWebServer(): void;

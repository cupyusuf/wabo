export declare function connectRabbitMQ(): Promise<void>;
export declare function publishIncoming(message: any): Promise<void>;
export declare function consumeOutgoing(handler: (msg: {
    jid: string;
    text: string;
}) => Promise<void>): Promise<void>;

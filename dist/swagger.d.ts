export declare const swaggerSpec: {
    openapi: string;
    info: {
        title: string;
        version: string;
        description: string;
    };
    paths: {
        '/api/status': {
            get: {
                summary: string;
                tags: string[];
                responses: {
                    '200': {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/api/send': {
            post: {
                summary: string;
                tags: string[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    '200': {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    '400': {
                        description: string;
                    };
                    '503': {
                        description: string;
                    };
                };
            };
        };
    };
    components: {
        schemas: {
            SendMessage: {
                type: string;
                required: string[];
                properties: {
                    jid: {
                        type: string;
                        example: string;
                        description: string;
                    };
                    text: {
                        type: string;
                        example: string;
                        description: string;
                    };
                };
            };
            Status: {
                type: string;
                properties: {
                    status: {
                        type: string;
                        enum: string[];
                    };
                };
            };
            Success: {
                type: string;
                properties: {
                    success: {
                        type: string;
                        example: boolean;
                    };
                    message: {
                        type: string;
                        example: string;
                    };
                };
            };
        };
    };
};

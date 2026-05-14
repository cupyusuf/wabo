"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePostgresAuthState = usePostgresAuthState;
const baileys_1 = require("baileys");
const baileys_2 = require("baileys");
const pool_1 = require("./pool");
async function usePostgresAuthState() {
    const readCreds = async () => {
        const { rows } = await pool_1.pool.query('SELECT data FROM auth_creds WHERE id = $1', ['creds']);
        if (rows.length) {
            return JSON.parse(JSON.stringify(rows[0].data), baileys_2.BufferJSON.reviver);
        }
        return (0, baileys_2.initAuthCreds)();
    };
    const saveCreds = async () => {
        const data = JSON.parse(JSON.stringify(creds, baileys_2.BufferJSON.replacer));
        await pool_1.pool.query(`INSERT INTO auth_creds (id, data, updated_at) VALUES ('creds', $1, NOW())
       ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()`, [data]);
    };
    const readKey = async (type, id) => {
        const { rows } = await pool_1.pool.query('SELECT data FROM auth_keys WHERE id = $1 AND type = $2', [`${type}-${id}`, type]);
        if (rows.length) {
            return JSON.parse(JSON.stringify(rows[0].data), baileys_2.BufferJSON.reviver);
        }
        return null;
    };
    const writeKey = async (type, id, data) => {
        const serialized = JSON.parse(JSON.stringify(data, baileys_2.BufferJSON.replacer));
        await pool_1.pool.query(`INSERT INTO auth_keys (id, type, data, updated_at) VALUES ($1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET data = $3, updated_at = NOW()`, [`${type}-${id}`, type, serialized]);
    };
    const removeKey = async (type, id) => {
        await pool_1.pool.query('DELETE FROM auth_keys WHERE id = $1 AND type = $2', [`${type}-${id}`, type]);
    };
    const creds = await readCreds();
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const result = {};
                    for (const id of ids) {
                        const value = await readKey(type, id);
                        if (value) {
                            if (type === 'app-state-sync-key' && value) {
                                result[id] = baileys_1.proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            else {
                                result[id] = value;
                            }
                        }
                    }
                    return result;
                },
                set: async (data) => {
                    for (const type in data) {
                        for (const id in data[type]) {
                            const value = data[type][id];
                            if (value) {
                                await writeKey(type, id, value);
                            }
                            else {
                                await removeKey(type, id);
                            }
                        }
                    }
                },
            },
        },
        saveCreds,
    };
}

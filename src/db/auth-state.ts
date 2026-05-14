import { proto } from 'baileys';
import { BufferJSON, initAuthCreds } from 'baileys';
import type { AuthenticationCreds, AuthenticationState, SignalDataTypeMap } from 'baileys';
import { pool } from './pool';

export async function usePostgresAuthState(): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const readCreds = async (): Promise<AuthenticationCreds> => {
    const { rows } = await pool.query('SELECT data FROM auth_creds WHERE id = $1', ['creds']);
    if (rows.length) {
      return JSON.parse(JSON.stringify(rows[0].data), BufferJSON.reviver);
    }
    return initAuthCreds();
  };

  const saveCreds = async () => {
    const data = JSON.parse(JSON.stringify(creds, BufferJSON.replacer));
    await pool.query(
      `INSERT INTO auth_creds (id, data, updated_at) VALUES ('creds', $1, NOW())
       ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()`,
      [data]
    );
  };

  const readKey = async (type: string, id: string) => {
    const { rows } = await pool.query('SELECT data FROM auth_keys WHERE id = $1 AND type = $2', [`${type}-${id}`, type]);
    if (rows.length) {
      return JSON.parse(JSON.stringify(rows[0].data), BufferJSON.reviver);
    }
    return null;
  };

  const writeKey = async (type: string, id: string, data: any) => {
    const serialized = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
    await pool.query(
      `INSERT INTO auth_keys (id, type, data, updated_at) VALUES ($1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET data = $3, updated_at = NOW()`,
      [`${type}-${id}`, type, serialized]
    );
  };

  const removeKey = async (type: string, id: string) => {
    await pool.query('DELETE FROM auth_keys WHERE id = $1 AND type = $2', [`${type}-${id}`, type]);
  };

  const creds = await readCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
          const result: { [id: string]: SignalDataTypeMap[T] } = {};
          for (const id of ids) {
            const value = await readKey(type, id);
            if (value) {
              if (type === 'app-state-sync-key' && value) {
                result[id] = proto.Message.AppStateSyncKeyData.fromObject(value) as any;
              } else {
                result[id] = value;
              }
            }
          }
          return result;
        },
        set: async (data: any) => {
          for (const type in data) {
            for (const id in data[type]) {
              const value = data[type][id];
              if (value) {
                await writeKey(type, id, value);
              } else {
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

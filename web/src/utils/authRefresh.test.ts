import axios, { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { installAuthRefresh, refreshAccessToken, SESSION_EXPIRED_EVENT } from './authRefresh';
import { tokenStore } from './token';

const response = (config: InternalAxiosRequestConfig, status: number, data: unknown = {}): AxiosResponse =>
  ({ data, status, statusText: String(status), headers: {}, config } as AxiosResponse);

const fail = (config: InternalAxiosRequestConfig, status: number) => {
  const error: any = new Error(`HTTP ${status}`);
  error.config = config;
  error.response = response(config, status);
  error.isAxiosError = true;
  return Promise.reject(error);
};

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

describe('refreshAccessToken', () => {
  it('shares one request between concurrent callers and stores the new tokens', async () => {
    tokenStore.setRefresh('refresh-1');
    const post = jest.spyOn(axios, 'post').mockResolvedValue({
      data: { data: { access_token: 'access-2', refresh_token: 'refresh-2' } },
    });

    const [a, b] = await Promise.all([refreshAccessToken(), refreshAccessToken()]);

    expect(post).toHaveBeenCalledTimes(1);
    expect(a).toBe('access-2');
    expect(b).toBe('access-2');
    expect(tokenStore.get()).toBe('access-2');
    expect(tokenStore.getRefresh()).toBe('refresh-2');
  });

  it('ends the session when the refresh token is rejected', async () => {
    tokenStore.set('old');
    tokenStore.setRefresh('bad');
    jest.spyOn(axios, 'post').mockRejectedValue({ response: { status: 401 } });
    const expired = jest.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);

    expect(await refreshAccessToken()).toBeNull();
    expect(tokenStore.get()).toBeNull();
    expect(expired).toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  });

  it('keeps the session on network errors', async () => {
    tokenStore.setRefresh('refresh-1');
    jest.spyOn(axios, 'post').mockRejectedValue(new Error('Network Error'));
    expect(await refreshAccessToken()).toBeNull();
    expect(tokenStore.getRefresh()).toBe('refresh-1');
  });
});

describe('installAuthRefresh', () => {
  it('refreshes once on a 401 and retries the request with the new token', async () => {
    tokenStore.set('expired');
    tokenStore.setRefresh('refresh-1');
    jest.spyOn(axios, 'post').mockResolvedValue({ data: { data: { access_token: 'fresh' } } });

    const seenTokens: (string | undefined)[] = [];
    const adapter: AxiosAdapter = config => {
      const auth = String(config.headers.get('Authorization') || '');
      seenTokens.push(auth);
      return auth === 'Bearer fresh' ? Promise.resolve(response(config, 200, { ok: true })) : fail(config, 401);
    };
    const client = axios.create({ adapter, headers: { Authorization: 'Bearer expired' } });
    installAuthRefresh(client);

    const result = await client.get('/api/v1/conversations');
    expect(result.data).toEqual({ ok: true });
    expect(seenTokens).toEqual(['Bearer expired', 'Bearer fresh']);
  });

  it("doesn't retry login failures", async () => {
    tokenStore.setRefresh('refresh-1');
    const post = jest.spyOn(axios, 'post');
    const client = axios.create({ adapter: config => fail(config, 401) });
    installAuthRefresh(client);

    await expect(client.post('/api/v1/auth/login', {})).rejects.toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });
});

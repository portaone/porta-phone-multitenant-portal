import axios, {AxiosError} from 'axios';
import {toast} from 'react-toastify';
import {useAuthStore} from './authStore';
import {config} from '../config/runtime';
import {isTokenExpired} from './auth';

const API_BASE_URL = config.BACKEND_URL;
export const API_VERSION = '/api/v1.0';

const api = axios.create({
    baseURL: `${API_BASE_URL}${API_VERSION}`,
    withCredentials: false,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    timeout: 20000
});

const PUBLIC_AUTH_PATHS = ['token', 'tenants/login', 'tenants/pwd_reset', 'signup'];

const isPublicAuthRequest = (url?: string) => {
    if (!url) return false;
    const path = url.split('?')[0].replace(/^\/+/, '').replace(/\/+$/, '');
    return PUBLIC_AUTH_PATHS.some((publicPath) => path === publicPath || path.startsWith(`${publicPath}/`));
};

let sessionExpiredNotified = false;

const handleSessionExpired = () => {
    if (sessionExpiredNotified) return;
    sessionExpiredNotified = true;
    toast.error('Session expired. Please log in again.', {toastId: 'session-expired'});
    useAuthStore.getState().clearAuth();
    // reset flag after a tick so next login cycle works
    setTimeout(() => { sessionExpiredNotified = false; }, 0);
};

api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;

    if (token) {
        if (isTokenExpired(token)) {
            handleSessionExpired();
        }
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        const status = error.response?.status;

        if (status === 401) {
            if (!isPublicAuthRequest(error.config?.url)) {
                const token = useAuthStore.getState().token;

                if (!token || isTokenExpired(token)) {
                    handleSessionExpired();
                } else {
                    toast.error('You are not authorized to perform this action.', {toastId: 'unauthorized-request'});
                }
            }
        } else if (status === 404) {
            toast.error('The requested resource was not found.');
        } else if (typeof status === 'number' && status >= 500) {
            toast.error(`We are having difficulties connecting to ${config.BRAND_NAME} servers. Try a bit later and if the problem persists - please let us know at ${config.SUPPORT_EMAIL}`);
        }

        return Promise.reject(error);
    }
);

export default api;

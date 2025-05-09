declare module 'react' {
    import * as React from 'react';
    export = React;
    export as namespace React;
}

declare module 'axios' {
    import * as axios from 'axios';
    export = axios;
    export as namespace axios;
}

declare module '@clerk/clerk-react' {
    export const useAuth: () => {
        getToken: () => Promise<string>;
    };
}

interface Window {
    Clerk?: {
        session?: {
            getToken: () => Promise<string>;
        };
    };
}

interface ImportMeta {
    env: {
        VITE_BACKEND_URL: string;
    };
}

declare namespace JSX {
    interface IntrinsicElements {
        [elemName: string]: any;
    }
} 
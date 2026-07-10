// ============================================================
// CLOUD.JS — Supabase accounts + cloud project storage
// Gracefully disables itself if Supabase isn't configured/loaded,
// so the app still works as a pure browser IDE without it.
// ============================================================

const CloudModule = (() => {
    let client = null;
    let user = null;
    let currentId = null;   // id of the cloud project currently open (for overwrite-on-save)
    let authCb = null;

    function init() {
        const libOk = window.supabase && typeof window.supabase.createClient === 'function';
        if (!libOk) {
            console.warn('☁ Cloud disabled: Supabase library did not load (window.supabase missing). Check the CDN <script> tag.');
            return false;
        }
        if (!window.SUPABASE_URL || !window.SUPABASE_KEY) {
            console.warn('☁ Cloud disabled: SUPABASE_URL / SUPABASE_KEY not set in supabase-config.js.');
            return false;
        }
        try {
            client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        } catch (e) {
            console.warn('☁ Could not start Supabase client:', e.message);
            return false;
        }

        client.auth.onAuthStateChange((_evt, session) => {
            user = (session && session.user) || null;
            if (authCb) authCb(user);
        });
        client.auth.getSession().then(({ data }) => {
            user = (data.session && data.session.user) || null;
            if (authCb) authCb(user);
        });
        return true;
    }

    const isEnabled = () => !!client;
    const getUser = () => user;
    const getCurrentId = () => currentId;
    const setCurrentId = (id) => { currentId = id; };
    function onAuthChange(cb) { authCb = cb; }

    async function signUp(email, password) {
        const { data, error } = await client.auth.signUp({ email, password });
        if (error) throw error;
        return data; // if email confirmation is OFF, data.session is set immediately
    }

    async function signIn(email, password) {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    }

    async function signOut() {
        await client.auth.signOut();
        currentId = null;
    }

    // Save (insert new, or overwrite the currently-open cloud project)
    async function saveProject(name, data) {
        if (!user) throw new Error('You are not logged in.');
        const row = { user_id: user.id, name, data, updated_at: new Date().toISOString() };
        if (currentId) row.id = currentId;
        const { data: saved, error } = await client
            .from('projects').upsert(row).select().single();
        if (error) throw error;
        currentId = saved.id;
        return saved;
    }

    async function listProjects() {
        const { data, error } = await client
            .from('projects')
            .select('id,name,updated_at')
            .order('updated_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    async function loadProject(id) {
        const { data, error } = await client
            .from('projects').select('*').eq('id', id).single();
        if (error) throw error;
        currentId = id;
        return data;
    }

    async function deleteProject(id) {
        const { error } = await client.from('projects').delete().eq('id', id);
        if (error) throw error;
        if (currentId === id) currentId = null;
    }

    return {
        init, isEnabled, getUser, getCurrentId, setCurrentId, onAuthChange,
        signUp, signIn, signOut, saveProject, listProjects, loadProject, deleteProject,
    };
})();

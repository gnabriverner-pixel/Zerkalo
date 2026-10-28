/**
 * Secondary paths (Meeting of Mirrors, «Мир девяти светил», «О методе», the old Alabaster page) are hidden by default:
 * the site leads to one path — the Code, then the Personal Myth, then Albert. The code stays; this flag brings the screens back
 * (build-time: VITE_SHOW_SECONDARY_PATHS=true). A function, so tests can switch it per case.
 */
export const showSecondaryPaths = (): boolean => import.meta.env.VITE_SHOW_SECONDARY_PATHS === 'true';

import React from 'react';
export const Link = ({ to, children, ...rest }) => React.createElement('a', { href: to, ...rest }, children);
export function createFileRoute(path) {
  return (options) => ({ path, options, useSearch: () => window.__search || {} });
}
export function useNavigate() { return (opts) => { (window.__nav = window.__nav || []).push(opts); return Promise.resolve(); }; }
export function redirect(opts) { return { __redirect: true, ...opts }; }
export const Outlet = () => null;

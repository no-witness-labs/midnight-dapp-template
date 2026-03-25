const _fetch = globalThis.fetch.bind(globalThis);
export default _fetch;
export { _fetch as fetch };

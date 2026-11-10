let renderFn = () => {};
export function setRender(fn) { renderFn = fn; }
export function render() { renderFn(); }

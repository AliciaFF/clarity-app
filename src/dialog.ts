type DialogOptions = {
  message: string;
  type: 'alert' | 'confirm';
  onOk: () => void;
  onCancel?: () => void;
};

type DialogHandler = (opts: DialogOptions) => void;

// Fallback natif si le composant n'est pas encore monté
let handler: DialogHandler = (opts) => {
  if (opts.type === 'confirm') {
    if (window.confirm(opts.message)) opts.onOk();
    else opts.onCancel?.();
  } else {
    window.alert(opts.message);
    opts.onOk();
  }
};

export const dialog = {
  register: (fn: DialogHandler) => { handler = fn; },
  alert: (message: string): Promise<void> =>
    new Promise(resolve => handler({ message, type: 'alert', onOk: resolve })),
  confirm: (message: string): Promise<boolean> =>
    new Promise(resolve => handler({
      message,
      type: 'confirm',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })),
};

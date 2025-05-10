// paypal.d.ts
interface PayPalButtons {
  (config: {
    style?: {
      layout?: 'vertical' | 'horizontal';
      color?: 'gold' | 'blue' | 'silver' | 'white' | 'black';
      shape?: 'rect' | 'pill';
      label?: 'paypal' | 'checkout' | 'buynow' | 'pay';
    };
    createOrder?: (data: any, actions: any) => Promise<string>;
    onApprove?: (data: any, actions: any) => Promise<void>;
    onError?: (err: any) => void;
    onCancel?: () => void;
  }): {
    render: (container: string) => Promise<void>;
  };
}

interface PayPalNamespace {
  Buttons: PayPalButtons;
}

declare global {
  interface Window {
    paypal: PayPalNamespace;
  }
}
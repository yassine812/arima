export interface Product {
  id: string;
  name: string;
  price: number; // in DT
  category: string;
  image: string;
  description: string;
}

export interface InvoiceItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: InvoiceItem[];
  subtotal: number;
  taxEnabled: boolean;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: "paid" | "unpaid" | "draft";
  cafeId?: string;     // Reference to the originating café
  cafeName?: string;   // Label of the café on A4 vector layouts
  orderId?: string;
  orderNumber?: string;
}

export interface Cafe {
  id: string;
  name: string;
  prices: { [productId: string]: number }; // overrides map (productId -> price)
  username?: string;
}

export type OrderStatus = "En attente" | "En préparation" | "Prête" | "Livrée" | "Annulée";

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  date: string;
  cafeId: string;
  cafeName: string;
  items: OrderItem[];
  totalQuantity: number;
  estimatedValue: number;
  status: OrderStatus;
  convertedToInvoiceId?: string;
  convertedToInvoiceNumber?: string;
  invoiceGeneratedOnOrder?: boolean;
  submissionKey?: string;
}

export type OrderSubmissionResult = Order & { invoice?: Invoice };

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  recipientId: "admin" | string; // 'admin' or reference to cafeId
  invoiceId?: string;
  orderId?: string;
}

export interface DashboardStats {
  totalSales: number;
  totalOrders: number;
  revenueUnpaid: number;
  bestSellers: {
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }[];
  categorySales: {
    name: string;
    value: number;
  }[];
  recentInvoices: Invoice[];
}

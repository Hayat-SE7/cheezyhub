// ─────────────────────────────────────────────
//  CheezyHub — Shared Types
// ─────────────────────────────────────────────

export type UserRole = 'customer' | 'kitchen' | 'delivery' | 'admin';

export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'assigned'
  | 'picked_up'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export type TicketPriority = 'low' | 'medium' | 'high';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

// ─── Users ───────────────────────────────────

export interface User {
  id: string;
  name: string;
  mobile?: string;
  email?: string;
  role: UserRole;
  createdAt: string;
}

export interface Staff {
  id: string;
  username: string;
  role: 'kitchen' | 'delivery' | 'admin';
  isActive: boolean;
  createdAt: string;
}

// ─── Menu ────────────────────────────────────

export interface Modifier {
  id: string;
  name: string;
  priceAdjustment: number;
  isAvailable: boolean;
  groupName: string; // e.g. "Size", "Toppings"
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  imageUrl?: string;
  category: string;
  isAvailable: boolean;
  modifierGroups: ModifierGroup[];
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  multiSelect: boolean;
  modifiers: Modifier[];
}

// ─── Cart ────────────────────────────────────

export interface CartItem {
  menuItemId: string;
  menuItem: MenuItem;
  quantity: number;
  selectedModifiers: Modifier[];
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

// ─── Orders ──────────────────────────────────

export interface OrderItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  selectedModifiers: { name: string; priceAdjustment: number }[];
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerMobile?: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  serviceCharge: number;
  total: number;
  deliveryAddress: string;
  deliveryLat?: number;
  deliveryLng?: number;
  driverId?: string;
  driverName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Tickets ─────────────────────────────────

export interface TicketMessage {
  id: string;
  senderRole: UserRole;
  message: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  customerId: string;
  customerName: string;
  orderId?: string;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

// ─── Financial Settings ───────────────────────

export interface SystemSettings {
  deliveryFee: number;
  serviceCharge: number;
  deliveryRadiusKm: number;
  restaurantLat: number;
  restaurantLng: number;
  ordersAccepting: boolean;
  restaurantName: string;
  restaurantPhone: string;
}

// ─── SSE Events ──────────────────────────────

export type SSEEvent =
  | { type: 'ORDER_CREATED'; payload: Order }
  | { type: 'ORDER_UPDATED'; payload: { orderId: string; status: OrderStatus } }
  | { type: 'ORDER_CANCELLED'; payload: { orderId: string } }
  | { type: 'ITEM_AVAILABILITY'; payload: { itemId: string; isAvailable: boolean } }
  | { type: 'MODIFIER_AVAILABILITY'; payload: { modifierId: string; isAvailable: boolean } }
  | { type: 'ORDERS_PAUSED'; payload: { paused: boolean } }
  | { type: 'TICKET_REPLY'; payload: { ticketId: string } };

// ─── API Responses ────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Auth ─────────────────────────────────────

export interface AuthTokenPayload {
  userId: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface LoginRequest {
  identifier: string; // mobile or email
  pin: string;
}

export interface LoginResponse {
  token: string;
  user: User | Staff;
  role: UserRole;
}

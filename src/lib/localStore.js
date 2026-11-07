import { cars as rentalCars } from "../data/cars.js";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";

const STORAGE_KEY = "bb-rentals-local-v1";
const SESSION_KEY = "bb-rentals-session-v1";
const listeners = new Set();
const collections = ["users", "profiles", "tenants", "tenant_members", "cars", "bookings"];
const demoBusinesses = [
  { id: "demo-bb-rentals", name: "BB Rentals", slug: "bb-rentals", carOffset: 0 },
  { id: "demo-city-wheels", name: "Demo: City Wheels", slug: "demo-city-wheels", carOffset: 4 },
  { id: "demo-krishna-car-rentals", name: "Demo: Krishna Car Rentals", slug: "demo-krishna-rentals", carOffset: 8 },
  { id: "demo-coastal-drive", name: "Demo: Coastal Drive Rentals", slug: "demo-coastal-drive", carOffset: 12 },
  { id: "demo-vijayawada-self-drive", name: "Demo: Vijayawada Self Drive", slug: "demo-vijayawada-drive", carOffset: 16 },
];
const demoCarsPerBusiness = 8;

function emptyStore() {
  return Object.fromEntries(collections.map(collection => [collection, []]));
}

function addDemoBusinesses(store) {
  let changed = false;
  const createdAt = new Date().toISOString();

  for (const business of demoBusinesses) {
    let tenant = store.tenants.find(item => item.slug === business.slug);
    if (!tenant) {
      tenant = {
        id: business.id,
        name: business.name,
        slug: business.slug,
        subscription_status: "active",
        created_at: createdAt,
      };
      store.tenants.push(tenant);
      changed = true;
    } else if (business.slug === "bb-rentals" && tenant.name.trim().toLowerCase() === "bb rentals" &&
        tenant.name !== business.name) {
      tenant.name = business.name;
      changed = true;
    }

    const businessCars = store.cars.filter(item => item.tenant_id === tenant.id);
    if (businessCars.length) continue;

    const templates = Array.from({ length: demoCarsPerBusiness }, (_, index) =>
      rentalCars[(business.carOffset + index) % rentalCars.length]);
    store.cars.push(...templates.map(car => ({
      id: car.id,
      tenant_id: tenant.id,
      name: car.name,
      rate: car.rate,
      category: car.category,
      seats: car.seats,
      transmission: car.transmission,
      fuel: car.fuel,
      image: car.image,
      second_image: car.secondImage,
      description: car.description,
      is_active: true,
      created_at: createdAt,
    })));
    changed = true;
  }

  return changed;
}

function readStore() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const value = stored ? JSON.parse(stored) : emptyStore();
    const store = Object.fromEntries(collections.map(key => [
      key,
      Array.isArray(value[key]) ? value[key] : [],
    ]));
    if (addDemoBusinesses(store)) writeStore(store);
    return store;
  } catch {
    throw new Error("Could not read app data from this browser. Check browser storage settings.");
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    throw new Error("Could not save app data in this browser. Check available storage space and privacy settings.");
  }
}

function currentUserId() {
  return localStorage.getItem(SESSION_KEY);
}

function randomUuid() {
  if (typeof globalThis.crypto?.randomUUID === "function") return crypto.randomUUID();
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("Secure random number generation is unavailable in this browser.");
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function toHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function localDateInput(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function makeError(message, code = "LOCAL_ERROR") {
  return { data: null, error: { message, code } };
}

function notifyAuth(event, user) {
  for (const listener of listeners) listener(event, user ? { user } : null);
}

export async function loadUserContext(userId, metadata = {}) {
  const store = readStore();
  const profile = store.profiles.find(item => item.id === userId);
  if (!profile) throw new Error("Your local account profile could not be found.");
  const memberships = store.tenant_members
    .filter(item => item.user_id === userId)
    .map(item => {
      const tenant = store.tenants.find(record => record.id === item.tenant_id);
      return tenant ? {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        role: item.role,
        subscriptionStatus: tenant.subscription_status,
      } : null;
    })
    .filter(Boolean);
  return {
    id: profile.id,
    username: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    role: profile.role,
    accountType: metadata.account_type || "customer",
    businessName: metadata.business_name || "",
    tenant: memberships[0] || null,
    memberships,
  };
}

export function getErrorMessage(error) {
  if (error?.code === "23P01" || error?.message?.includes("already booked")) {
    return "This car is already booked for some of those dates. Choose different dates.";
  }
  if (error?.message?.includes("Invalid rental dates")) {
    return "Choose a return date on or after today and on or after the pick-up date.";
  }
  return error?.message || "The request could not be completed. Please try again.";
}

function matchesFilter(row, filter) {
  const value = row[filter.column];
  if (filter.operator === "eq") return value === filter.value;
  if (filter.operator === "neq") return value !== filter.value;
  if (filter.operator === "in") return filter.value.includes(value);
  if (filter.operator === "lte") return value <= filter.value;
  if (filter.operator === "gte") return value >= filter.value;
  return true;
}

function projectRow(table, row, columns, store) {
  if (table === "tenant_members" && columns.includes("tenants!inner")) {
    const tenant = store.tenants.find(item => item.id === row.tenant_id);
    if (!tenant) return null;
    const requested = columns.match(/tenants!inner\(([^)]+)\)/)?.[1]?.split(",") || [];
    return {
      tenant_id: row.tenant_id,
      role: row.role,
      tenants: Object.fromEntries(requested.map(key => {
        const column = key.trim();
        return [column, tenant[column]];
      })),
    };
  }
  if (columns === "*" || columns === "") return { ...row };
  return Object.fromEntries(columns.split(",").map(column => {
    const key = column.trim();
    return [key, row[key]];
  }));
}

class LocalQuery {
  constructor(table) {
    this.table = table;
    this.operation = "select";
    this.columns = "*";
    this.payload = null;
    this.filters = [];
    this.sort = null;
  }

  select(columns = "*") { this.columns = columns; return this; }
  insert(values) { this.operation = "insert"; this.payload = values; return this; }
  update(values) { this.operation = "update"; this.payload = values; return this; }
  eq(column, value) { this.filters.push({ operator: "eq", column, value }); return this; }
  neq(column, value) { this.filters.push({ operator: "neq", column, value }); return this; }
  in(column, value) { this.filters.push({ operator: "in", column, value }); return this; }
  lte(column, value) { this.filters.push({ operator: "lte", column, value }); return this; }
  gte(column, value) { this.filters.push({ operator: "gte", column, value }); return this; }

  order(column, options = {}) {
    this.sort = { column, ascending: options.ascending !== false };
    return this;
  }

  async single() {
    const result = await this.execute();
    if (result.error) return result;
    if (result.data.length !== 1) return makeError("Expected one matching record.");
    return { data: result.data[0], error: null };
  }

  async maybeSingle() {
    const result = await this.execute();
    if (result.error) return result;
    if (result.data.length > 1) return makeError("Expected at most one matching record.");
    return { data: result.data[0] || null, error: null };
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  async execute() {
    try {
      const store = readStore();
      if (!Array.isArray(store[this.table])) return makeError(`Unknown local data collection: ${this.table}.`);
      if (this.operation === "select") return this.selectRows(store);
      const userId = currentUserId();
      if (!userId) return makeError("Sign in before changing app data.", "401");
      if (this.operation === "insert") return this.insertRows(store, userId);
      if (this.operation === "update") return this.updateRows(store, userId);
      return makeError("Unsupported local data operation.");
    } catch (error) {
      return makeError(error.message);
    }
  }

  selectRows(store) {
    const userId = currentUserId();
    const memberTenantIds = new Set(store.tenant_members
      .filter(item => item.user_id === userId)
      .map(item => item.tenant_id));
    let rows = store[this.table];
    if (this.table === "profiles") rows = rows.filter(row => row.id === userId);
    if (this.table === "tenant_members") rows = rows.filter(row => row.user_id === userId);
    if (this.table === "tenants") {
      rows = rows.filter(row => ["active", "trialing"].includes(row.subscription_status) || memberTenantIds.has(row.id));
    }
    if (this.table === "bookings") {
      rows = rows.filter(row => row.customer_id === userId || memberTenantIds.has(row.tenant_id));
    }
    if (this.table === "cars") {
      rows = rows.filter(row => row.is_active || memberTenantIds.has(row.tenant_id));
    }
    rows = rows.filter(row => this.filters.every(filter => matchesFilter(row, filter)));
    if (this.sort) {
      const { column, ascending } = this.sort;
      rows = [...rows].sort((a, b) => {
        const comparison = a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0;
        return ascending ? comparison : -comparison;
      });
    }
    return {
      data: rows.map(row => projectRow(this.table, row, this.columns, store)).filter(Boolean),
      error: null,
    };
  }

  insertRows(store, userId) {
    const inputRows = Array.isArray(this.payload) ? this.payload : [this.payload];
    const prepared = inputRows.map(input => this.prepareInsert(store, input, userId));
    const failed = prepared.find(result => result.error);
    if (failed) return makeError(failed.error);
    const rows = prepared.map(result => result.row);
    store[this.table].push(...rows);
    writeStore(store);
    return {
      data: rows.map(row => projectRow(this.table, row, this.columns, store)),
      error: null,
    };
  }

  updateRows(store, userId) {
    const matching = store[this.table].filter(row => this.filters.every(filter => matchesFilter(row, filter)));
    const updated = [];
    for (const row of matching) {
      if (this.table === "cars" || this.table === "bookings") {
        const manager = store.tenant_members.find(item =>
          item.tenant_id === row.tenant_id && item.user_id === userId && ["owner", "manager"].includes(item.role));
        if (!manager) return makeError("You do not have permission to change this record.", "403");
      }
      if (this.table === "cars" && this.payload.rate !== undefined &&
          (!Number.isFinite(Number(this.payload.rate)) || Number(this.payload.rate) <= 0)) {
        return makeError("Enter a valid daily rental price greater than zero.");
      }
      if (this.table === "bookings" &&
          (!["pending", "paid"].includes(this.payload.payment_status) ||
           !Number.isFinite(Number(this.payload.paid_amount)) || Number(this.payload.paid_amount) < 0)) {
        return makeError("Enter a valid payment status and amount.");
      }
      Object.assign(row, this.payload, { updated_at: new Date().toISOString() });
      updated.push(projectRow(this.table, row, this.columns, store));
    }
    writeStore(store);
    return { data: updated, error: null };
  }

  prepareInsert(store, input, userId) {
    const row = { ...input };
    if (this.table === "bookings") {
      const profile = store.profiles.find(item => item.id === userId);
      const car = store.cars.find(item => item.id === row.car_id &&
        item.tenant_id === row.tenant_id && item.is_active);
      const tenant = store.tenants.find(item => item.id === row.tenant_id);
      if (!profile || !car || !tenant || !["active", "trialing"].includes(tenant.subscription_status)) {
        return { error: "This vehicle is not currently available for booking." };
      }
      if (row.start_date < localDateInput() || row.end_date < row.start_date) {
        return { error: "Invalid rental dates." };
      }
      if (!["Cash at pickup", "UPI at pickup"].includes(row.payment_method)) {
        return { error: "Choose a valid payment method." };
      }
      if (store.bookings.some(item =>
        item.tenant_id === row.tenant_id && item.car_id === row.car_id && item.status === "confirmed" &&
        item.start_date <= row.end_date && item.end_date >= row.start_date)) {
        return { error: "This car is already booked for some of those dates." };
      }
      const days = Math.round(
        (new Date(`${row.end_date}T00:00:00`) - new Date(`${row.start_date}T00:00:00`)) / 86400000,
      ) + 1;
      Object.assign(row, {
        id: randomUuid(),
        customer_id: userId,
        customer_name: profile.full_name,
        customer_email: profile.email,
        customer_phone: profile.phone,
        car_name: car.name,
        daily_rate: car.rate,
        total_amount: car.rate * days,
        payment_status: "pending",
        paid_amount: 0,
        status: "confirmed",
        created_at: new Date().toISOString(),
      });
    } else if (this.table === "cars") {
      const manager = store.tenant_members.find(item =>
        item.tenant_id === row.tenant_id && item.user_id === userId && ["owner", "manager"].includes(item.role));
      if (!manager) return { error: "Only workspace managers can add vehicles." };
      Object.assign(row, { is_active: true, created_at: new Date().toISOString() });
    } else {
      return { error: `Adding records to ${this.table} is not supported.` };
    }
    return { row };
  }
}

async function hashPassword(password, salt) {
  const hash = await pbkdf2Async(sha256, password, salt, {
    c: 210000,
    dkLen: 32,
    asyncTick: 10,
  });
  return toHex(hash);
}

async function legacyPasswordHash(password, salt) {
  return toHex(sha256(utf8ToBytes(`${salt}:${password}`)));
}

const auth = {
  async signUp({ email, password, options }) {
    try {
      const store = readStore();
      const normalizedEmail = email.trim().toLowerCase();
      if (store.users.some(user => user.email === normalizedEmail)) {
        return makeError("An account with this email already exists.");
      }
      if (!globalThis.crypto?.getRandomValues) {
        return makeError("Secure random number generation is unavailable in this browser.");
      }
      const metadata = options?.data || {};
      const id = randomUuid();
      const salt = randomUuid();
      const user = {
        id,
        email: normalizedEmail,
        salt,
        passwordHash: await hashPassword(password, salt),
        user_metadata: metadata,
      };
      store.users.push(user);
      store.profiles.push({
        id,
        full_name: metadata.full_name || "",
        email: normalizedEmail,
        phone: metadata.phone || "",
        role: "customer",
      });
      writeStore(store);
      localStorage.setItem(SESSION_KEY, id);
      notifyAuth("SIGNED_IN", user);
      return { data: { user, session: { user } }, error: null };
    } catch (error) {
      return makeError(error.message);
    }
  },

  async signInWithPassword({ email, password }) {
    try {
      const store = readStore();
      const normalizedEmail = email.trim().toLowerCase();
      const user = store.users.find(item => item.email === normalizedEmail);
      if (!user) return makeError("Email or password is incorrect.", "401");
      let passwordHash = await hashPassword(password, user.salt);
      if (passwordHash !== user.passwordHash) {
        passwordHash = await legacyPasswordHash(password, user.salt);
        if (passwordHash !== user.passwordHash) return makeError("Email or password is incorrect.", "401");
        user.salt = randomUuid();
        user.passwordHash = await hashPassword(password, user.salt);
        writeStore(store);
      }
      localStorage.setItem(SESSION_KEY, user.id);
      notifyAuth("SIGNED_IN", user);
      return { data: { user, session: { user } }, error: null };
    } catch (error) {
      return makeError(error.message);
    }
  },

  async signOut() {
    try {
      localStorage.removeItem(SESSION_KEY);
      notifyAuth("SIGNED_OUT", null);
      return { error: null };
    } catch (error) {
      return { error: { message: error.message } };
    }
  },

  async getSession() {
    try {
      const id = currentUserId();
      const user = id ? readStore().users.find(item => item.id === id) : null;
      return { data: { session: user ? { user } : null }, error: null };
    } catch (error) {
      return { data: { session: null }, error: { message: error.message } };
    }
  },

  onAuthStateChange(callback) {
    listeners.add(callback);
    return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
  },
};

const localStore = {
  auth,
  from(table) {
    return new LocalQuery(table);
  },
  async rpc(name, args) {
    if (name !== "create_business_tenant") {
      return makeError(`Unknown local operation: ${name}.`);
    }
    try {
      const store = readStore();
      const userId = currentUserId();
      const businessName = String(args.business_name || "").trim();
      const slug = String(args.business_slug || "").trim();
      if (!userId) return makeError("Sign in before creating a business workspace.");
      if (store.tenant_members.some(item => item.user_id === userId)) {
        return makeError("This account already belongs to a rental workspace.");
      }
      if (businessName.length < 2 || businessName.length > 100) {
        return makeError("Business name must be between 2 and 100 characters.");
      }
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 50) {
        return makeError("Choose a URL slug containing lowercase letters, numbers, and single hyphens.");
      }
      if (store.tenants.some(item => item.slug === slug)) {
        return makeError("That storefront address is already in use.");
      }
      const id = randomUuid();
      const createdAt = new Date().toISOString();
      store.tenants.push({
        id,
        name: businessName,
        slug,
        subscription_status: "active",
        created_at: createdAt,
      });
      store.tenant_members.push({
        tenant_id: id,
        user_id: userId,
        role: "owner",
        created_at: createdAt,
      });
      store.cars.push(...rentalCars.map(car => ({
        id: car.id,
        tenant_id: id,
        name: car.name,
        rate: car.rate,
        category: car.category,
        seats: car.seats,
        transmission: car.transmission,
        fuel: car.fuel,
        image: car.image,
        second_image: car.secondImage,
        description: car.description,
        is_active: true,
        created_at: createdAt,
      })));
      writeStore(store);
      return {
        data: [{ tenant_id: id, tenant_name: businessName, tenant_slug: slug }],
        error: null,
      };
    } catch (error) {
      return makeError(error.message);
    }
  },
};

export { localStore };

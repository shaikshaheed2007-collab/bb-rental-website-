import { useEffect, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  loadUserContext,
  getErrorMessage,
  localStore,
} from "./lib/localStore.js";
import { cars as carTemplates } from "./data/cars.js";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function getLocalDateInputValue(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function carFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    rate: Number(row.rate),
    category: row.category,
    seats: row.seats,
    transmission: row.transmission,
    fuel: row.fuel,
    image: row.image,
    secondImage: row.second_image,
    description: row.description,
  };
}

function PageFrame({ children, className = "" }) {
  return <main className={`app-page ${className}`}>{children}</main>;
}

function Header({ user, onLogout, tenant = null }) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link className="logo" to="/">BB <span>RENTALS</span></Link>
        <nav className="app-nav" aria-label="Main navigation">
          {tenant ? (
            <>
              <Link to={`/r/${tenant.slug}`}>Cars</Link>
              <Link to="/rentals">Other rentals</Link>
              {user && !user.tenant && <Link to="/payments">My Bookings</Link>}
              {user?.tenant && <Link to="/dashboard">Business dashboard</Link>}
            </>
          ) : (
            <>
              <Link to="/">Home</Link>
              <Link to="/rentals">Find rentals</Link>
              <Link to="/about">About</Link>
              {user?.tenant && <Link to="/dashboard">Business dashboard</Link>}
            </>
          )}
        </nav>
        <div className="app-header-actions">
          {user ? (
            <>
              <span className="header-user">{user.username}</span>
              {user.tenant && <Link className="outline-button" to="/dashboard">Dashboard</Link>}
              <button className="outline-button" type="button" onClick={onLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link className="outline-button" to="/login">User Login</Link>
              <Link className="primary-button compact-button" to="/business/login">Business login</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="app-footer">
      <Link className="logo" to="/">BB <span>RENTALS</span></Link>
      <p>Quality cars. Easy rentals in Vijayawada.</p>
      <p><a href="mailto:hello@bbrentals.com">hello@bbrentals.com</a></p>
      <small>© {new Date().getFullYear()} BB RENTALS</small>
    </footer>
  );
}

function AppShell({ user, onLogout, error, children }) {
  return (
    <>
      <Header user={user} onLogout={onLogout} />
      {error && <div className="app-alert" role="alert">{error}</div>}
      {children}
    </>
  );
}

function CarCard({ car, tenantSlug }) {
  const detailsPath = tenantSlug ? `/r/${tenantSlug}/cars/${car.id}` : `/cars/${car.id}`;
  return (
    <article className="car-card">
      <Link className="car-image" to={detailsPath}>
        <img src={`/images/${car.image}`} alt={car.name} />
      </Link>
      <div className="car-info">
        <p className="car-category">{car.category}</p>
        <h3><Link to={detailsPath}>{car.name}</Link></h3>
        <div className="car-specs"><span>{car.seats} seats</span><span>{car.transmission}</span><span>{car.fuel}</span></div>
        <div className="car-bottom">
          <strong>{currency.format(car.rate)} <small>/ day</small></strong>
          <Link className="rent-btn" to={detailsPath}>View details</Link>
        </div>
      </div>
    </article>
  );
}

function FleetGrid({ cars, loading, error, tenantSlug }) {
  if (loading) return <p className="empty-state" role="status">Loading cars…</p>;
  if (error) return <p className="form-message error-message" role="alert">{error}</p>;
  if (!cars.length) return <p className="empty-state">No cars are currently available.</p>;
  return <div className="car-grid">{cars.map(car => <CarCard key={car.id} car={car} tenantSlug={tenantSlug} />)}</div>;
}

function HomePage({ user }) {
  return (
    <>
      <section className="app-hero">
        <div className="app-hero-content">
          <p className="eyebrow">CAR RENTAL BUSINESS SOFTWARE</p>
          <h1>Run Your Fleet.<br /><span>Grow Your Business.</span></h1>
          <p>Launch a rental storefront, manage bookings, and keep your business moving with BB Rentals.</p>
          <div className="hero-actions">
            <Link className="primary-button" to={user?.tenant ? "/dashboard" : "/business/signup"}>{user?.tenant ? "Open dashboard" : "Create a rental business"}</Link>
            <Link className="outline-button" to="/rentals">Find a rental</Link>
          </div>
        </div>
      </section>
      <PageFrame>
        <div className="section-title">
          <div><p className="eyebrow">FOR RENTAL OPERATORS</p><h2>Your business, <span>one dashboard</span></h2></div>
        </div>
        <section className="feature-strip">
          <div><strong>Your fleet</strong><span>Set prices and availability</span></div>
          <div><strong>Bookings</strong><span>Share your public rental storefront</span></div>
          <div><strong>Payments</strong><span>Track pay-at-pickup collections</span></div>
        </section>
        <p className="fine-print">Create a business account to set up a storefront and manage your rental fleet.</p>
      </PageFrame>
      <Footer />
    </>
  );
}

function RentalCompaniesPage({ onLogout, user }) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadTenants() {
      const { data, error: queryError } = await localStore
        .from("tenants")
        .select("id,name,slug")
        .in("subscription_status", ["active", "trialing"])
        .order("name");
      if (!active) return;
      if (queryError) setError(getErrorMessage(queryError));
      else setTenants(data);
      setLoading(false);
    }
    loadTenants();
    return () => { active = false; };
  }, []);

  return (
    <>
      <AppShell user={user} onLogout={onLogout}>
        <section className="page-banner"><p className="eyebrow">BB RENTALS DIRECTORY</p><h1>Find a rental <span>business</span></h1><p>Browse available cars from BB Rentals and other rental businesses.</p></section>
        <PageFrame>
          <p className="fine-print">Demo businesses are sample listings for exploring the app. Create a business account to set up your own storefront.</p>
          {error ? <p className="form-message error-message">{error}</p> : loading ? <p className="empty-state" role="status">Loading rental companies…</p> : tenants.length === 0 ? <p className="empty-state">No rental businesses are listed yet.</p> :
            <div className="company-grid">{tenants.map(tenant => <article className="company-card" key={tenant.id}>
              <p className="eyebrow">RENTAL PARTNER</p><h2>{tenant.name}</h2><p>Browse available cars and make a reservation.</p>
              <Link className="primary-button" to={`/r/${tenant.slug}`}>View vehicles</Link>
            </article>)}</div>}
        </PageFrame>
        <Footer />
      </AppShell>
    </>
  );
}

function RentalStorefront({ user, onLogout }) {
  const { tenantSlug } = useParams();
  const [store, setStore] = useState({ tenant: null, cars: [], loading: true, error: "" });

  useEffect(() => {
    let active = true;
    async function loadStore() {
      const { data: tenant, error: tenantError } = await localStore
        .from("tenants")
        .select("id,name,slug,subscription_status")
        .eq("slug", tenantSlug)
        .maybeSingle();
      if (!active) return;
      if (tenantError) {
        setStore({ tenant: null, cars: [], loading: false, error: getErrorMessage(tenantError) });
        return;
      }
      if (!tenant) {
        setStore({ tenant: null, cars: [], loading: false, error: "This rental business is unavailable." });
        return;
      }
      const { data: cars, error: carsError } = await localStore
        .from("cars")
        .select("id,name,rate,category,seats,transmission,fuel,image,second_image,description")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true)
        .order("name");
      if (!active) return;
      setStore(carsError
        ? { tenant, cars: [], loading: false, error: getErrorMessage(carsError) }
        : { tenant, cars: cars.map(carFromRow), loading: false, error: "" });
    }
    loadStore();
    return () => { active = false; };
  }, [tenantSlug]);

  if (store.loading) return <><Header user={user} onLogout={onLogout} /><PageFrame><p role="status">Loading rental business…</p></PageFrame></>;
  if (store.error || !store.tenant) return <><AppShell user={user} onLogout={onLogout}><PageFrame><p className="form-message error-message">{store.error || "This rental business is unavailable."}</p><Link className="text-link" to="/rentals">Browse other rentals</Link></PageFrame></AppShell><Footer /></>;

  return <AppShell user={user} onLogout={onLogout} tenant={store.tenant}>
    <section className="page-banner"><p className="eyebrow">RENTAL PARTNER</p><h1>{store.tenant.name}</h1><p>Available vehicles in Vijayawada.</p></section>
    <PageFrame>
      <div className="location-notice">Select a vehicle to view rates and reserve your dates.</div>
      <FleetGrid cars={store.cars} loading={false} error="" tenantSlug={store.tenant.slug} />
    </PageFrame>
    <Footer />
  </AppShell>;
}

function AboutPage() {
  return (
    <>
      <section className="page-banner"><p className="eyebrow">ABOUT BB RENTALS</p><h1>Ready for the <span>road?</span></h1><p>Premium cars and easy rentals in Vijayawada.</p></section>
      <PageFrame className="about-copy">
        <h2>Car rental made simple</h2>
        <p>Choose from our collection, select your dates, and reserve the car that fits your journey. Each vehicle is available for pick-up in Vijayawada, Andhra Pradesh.</p>
        <Link to="/cars" className="primary-button">Explore the fleet</Link>
      </PageFrame>
      <Footer />
    </>
  );
}

function RentalCarDetails({ user, onLogout }) {
  const { carId } = useParams();
  const { tenantSlug } = useParams();
  const [details, setDetails] = useState({ tenant: null, car: null, loading: true, error: "" });

  useEffect(() => {
    let active = true;
    async function loadDetails() {
      const { data: tenant, error: tenantError } = await localStore
        .from("tenants")
        .select("id,name,slug,subscription_status")
        .eq("slug", tenantSlug)
        .maybeSingle();
      if (!active) return;
      if (tenantError || !tenant) {
        setDetails({ tenant: null, car: null, loading: false, error: tenantError ? getErrorMessage(tenantError) : "This rental business is unavailable." });
        return;
      }
      const { data: car, error: carError } = await localStore
        .from("cars")
        .select("id,name,rate,category,seats,transmission,fuel,image,second_image,description")
        .eq("tenant_id", tenant.id)
        .eq("id", carId)
        .eq("is_active", true)
        .maybeSingle();
      if (!active) return;
      setDetails({
        tenant,
        car: car ? carFromRow(car) : null,
        loading: false,
        error: carError ? getErrorMessage(carError) : "",
      });
    }
    loadDetails();
    return () => { active = false; };
  }, [carId, tenantSlug]);

  if (details.loading) return <><Header user={user} onLogout={onLogout} /><PageFrame><p role="status">Loading vehicle details…</p></PageFrame></>;
  if (details.error || !details.tenant || !details.car) return <><AppShell user={user} onLogout={onLogout}><PageFrame><p className="form-message error-message">{details.error || "This vehicle is unavailable."}</p><Link className="text-link" to={`/r/${tenantSlug}`}>Back to vehicles</Link></PageFrame></AppShell><Footer /></>;
  return <CarDetailsPage tenant={details.tenant} car={details.car} user={user} onLogout={onLogout} />;
}

function CarDetailsPage({ tenant, car, user, onLogout }) {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pickup, setPickup] = useState(getLocalDateInputValue());
  const [returnDate, setReturnDate] = useState(getLocalDateInputValue());
  const [method, setMethod] = useState("Cash at pickup");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const start = new Date(`${pickup}T00:00:00`);
  const end = new Date(`${returnDate}T00:00:00`);
  const days = pickup && returnDate && end >= start
    ? Math.round((end - start) / 86400000) + 1
    : 0;
  const total = days * car.rate;

  function beginBooking() {
    if (!user) {
      navigate(`/login?returnTo=${encodeURIComponent(`/r/${tenant.slug}/cars/${car.id}`)}`);
      return;
    }
    if (user.tenant?.id === tenant.id) {
      setMessage("Sign in with a customer account to book vehicles from this rental business.");
      return;
    }
    setMessage("");
    setDialogOpen(true);
  }

  async function confirmBooking(event) {
    event.preventDefault();
    if (!days) {
      setMessage("Choose valid pick-up and return dates.");
      return;
    }
    setSaving(true);
    setMessage("");
    const { error } = await localStore.from("bookings").insert({
      tenant_id: tenant.id,
      car_id: car.id,
      start_date: pickup,
      end_date: returnDate,
      payment_method: method,
    });
    setSaving(false);
    if (error) {
      setMessage(getErrorMessage(error));
      return;
    }
    setDialogOpen(false);
    navigate("/payments", { state: { notice: "Rental saved. Payment is pending and due at pick-up." } });
  }

  return (
    <>
      <AppShell user={user} onLogout={onLogout} tenant={tenant}>
        <PageFrame className="details-page">
          <Link to={`/r/${tenant.slug}`} className="text-link">← Back to cars</Link>
          <section className="details-layout">
            <div className="details-photo"><img src={`/images/${car.image}`} alt={car.name} /><img src={`/images/${car.secondImage}`} alt={`${car.name} side view`} /></div>
            <div className="details-panel">
              <p className="eyebrow">{car.category}</p><h1>{car.name}</h1>
              <p className="muted">{tenant.name} · Vijayawada, Andhra Pradesh</p>
              <p>{car.description}</p>
              <p className="details-rate">{currency.format(car.rate)} <small>/ day</small></p>
              <div className="detail-specs"><span>{car.seats} seats</span><span>{car.transmission}</span><span>{car.fuel}</span></div>
              <button type="button" className="primary-button" onClick={beginBooking}>Rent this car</button>
            </div>
          </section>
        </PageFrame>
        <Footer />
      </AppShell>
      {dialogOpen && <div className="modal-backdrop" role="presentation">
        <form className="booking-modal" onSubmit={confirmBooking}>
          <button type="button" className="modal-close" aria-label="Close" onClick={() => setDialogOpen(false)}>×</button>
          <p className="eyebrow">BB RENTALS BOOKING</p><h2>Confirm your rental</h2>
          <strong>{car.name}</strong><p className="text-lime">{currency.format(car.rate)} / day</p>
          <div className="form-grid">
            <label>Pick-up date<input type="date" min={getLocalDateInputValue()} value={pickup} onChange={event => setPickup(event.target.value)} required /></label>
            <label>Return date<input type="date" min={pickup} value={returnDate} onChange={event => setReturnDate(event.target.value)} required /></label>
          </div>
          <p className="total-line">Estimated total <strong>{days ? `${currency.format(total)} for ${days} day${days === 1 ? "" : "s"}` : "Choose valid rental dates"}</strong></p>
          <fieldset className="payment-choice"><legend>Payment details</legend>
            <label>Payment method<select value={method} onChange={event => setMethod(event.target.value)}><option>Cash at pickup</option><option>UPI at pickup</option></select></label>
            <small>Payment is not processed online. The amount is due when you pick up the car.</small>
          </fieldset>
          {message && <p className="form-message error-message" role="alert">{message}</p>}
          <div className="modal-actions"><button type="button" className="outline-button" onClick={() => setDialogOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : "Confirm rental"}</button></div>
        </form>
      </div>}
    </>
  );
}

function AuthLayout({ children, admin = false }) {
  return (
    <main className="auth-page">
      <section className="auth-side">
        <Link className="logo" to="/">BB <span>RENTALS</span></Link>
        <Link to="/" className="auth-back">← Back to home</Link>
        <div><p className="eyebrow">{admin ? "ADMINISTRATION" : "PREMIUM CAR RENTALS"}</p><h1>{admin ? "Manage Your Rental Business." : "Your Journey Starts Here."}</h1><p>Sign in to continue your BB RENTALS experience.</p></div>
      </section>
      <section className="auth-content">{children}</section>
    </main>
  );
}

function LoginPage({ expectedRole = "customer", onAuthenticated }) {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isBusinessLogin = expectedRole === "business";

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const { data, error: loginError } = await localStore.auth.signInWithPassword({
      email: String(form.get("email")).trim().toLowerCase(),
      password: String(form.get("password")),
    });
    if (loginError) {
      setError(getErrorMessage(loginError));
      setBusy(false);
      return;
    }

    let profile;
    try {
      profile = await loadUserContext(data.user.id, data.user.user_metadata || {});
    } catch (profileError) {
      await localStore.auth.signOut();
      setError(getErrorMessage(profileError));
      setBusy(false);
      return;
    }
    if (isBusinessLogin && !profile.tenant && profile.accountType !== "business") {
      await localStore.auth.signOut();
      setError("Create a rental business account before using business login.");
      setBusy(false);
      return;
    }
    if (!isBusinessLogin && profile.tenant) {
      await localStore.auth.signOut();
      setError("This is a rental business account. Use business login instead.");
      setBusy(false);
      return;
    }

    onAuthenticated(profile);
    if (isBusinessLogin && !profile.tenant) {
      navigate("/business/setup", { replace: true });
    } else {
      const returnTo = search.get("returnTo") || (isBusinessLogin ? "/dashboard" : "/");
      const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//")
        ? returnTo
        : (isBusinessLogin ? "/dashboard" : "/");
      navigate(safeReturnTo, { replace: true });
    }
    setBusy(false);
  }

  return <AuthLayout admin={isBusinessLogin}><div className="auth-card">
    <p className="eyebrow">{isBusinessLogin ? "RENTAL BUSINESS" : "CUSTOMER ACCOUNT"}</p>
    <h2>{isBusinessLogin ? "Business login" : "Customer sign in"}</h2>
    <p className="muted">Sign in with your BB Rentals account.</p>
    <form className="app-form" onSubmit={submit}>
      <label>Email address<input name="email" type="email" autoComplete="username" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      {error && <p className="form-message error-message" role="alert">{error}</p>}
      <button className="primary-button full-button" type="submit" disabled={busy}>{busy ? "Signing in…" : isBusinessLogin ? "Business login →" : "Login →"}</button>
    </form>
    {!isBusinessLogin && <p className="auth-switch">New customer? <Link to="/signup">Create an account</Link></p>}
    {isBusinessLogin
      ? <p className="auth-switch">New rental business? <Link to="/business/signup">Create a business account</Link></p>
      : <p className="auth-switch">Rental business? <Link to="/business/login">Business login</Link></p>}
    {isBusinessLogin && <p className="fine-print">New to BB Rentals? Create a business account first. Your account is saved in this browser.</p>}
  </div></AuthLayout>;
}

function SignupPage({ business = false, onAuthenticated }) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username")).trim();
    const email = String(form.get("email")).trim().toLowerCase();
    const phone = String(form.get("phone")).trim();
    const businessName = String(form.get("businessName") || "").trim();
    const password = String(form.get("password"));
    if (password !== form.get("confirmPassword")) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    const { data, error: signupError } = await localStore.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: username,
          phone,
          account_type: business ? "business" : "customer",
          ...(business ? { business_name: businessName } : {}),
        },
      },
    });
    setBusy(false);
    if (signupError) {
      setError(getErrorMessage(signupError));
      return;
    }
    if (data.session) {
      try {
        const profile = await loadUserContext(data.user.id, data.user.user_metadata || {});
        onAuthenticated(profile);
      } catch (profileError) {
        setError(getErrorMessage(profileError));
        return;
      }
      navigate(business ? "/business/setup" : "/", { replace: true });
      return;
    }
    setError("The account was created but could not be signed in. Please try signing in.");
  }

  return <AuthLayout><div className="auth-card">
    <p className="eyebrow">{business ? "START YOUR RENTAL BUSINESS" : "JOIN BB RENTALS"}</p><h2>{business ? "Create business account" : "Create account"}</h2>
    <p className="muted">Your account is saved in this browser. It is not shared across devices.</p>
    <form className="app-form" onSubmit={submit}>
      <label>Full name<input name="username" autoComplete="name" minLength={2} maxLength={100} required /></label>
      {business && <label>Rental business name<input name="businessName" autoComplete="organization" minLength={2} maxLength={100} required /></label>}
      <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
      <label>Phone number<input name="phone" type="tel" autoComplete="tel" maxLength={30} required /></label>
      <label>Password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
      {error && <p className="form-message error-message" role="alert">{error}</p>}
      <button className="primary-button full-button" type="submit" disabled={busy}>{busy ? "Creating account…" : business ? "Create business account" : "Create account"}</button>
    </form>
    {business
      ? <p className="auth-switch">Already registered? <Link to="/business/login">Business login</Link></p>
      : <><p className="auth-switch">Already registered? <Link to="/login">Customer login</Link></p><p className="auth-switch">Rental operator? <Link to="/business/signup">Start a business account</Link></p></>}
  </div></AuthLayout>;
}

function BusinessSetupPage({ user, onWorkspaceCreated }) {
  const [name, setName] = useState(user.businessName || "");
  const [slug, setSlug] = useState(() => (user.businessName || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  const [workspace, setWorkspace] = useState(user.tenant || null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const normalizedSlug = slug.toLowerCase().trim();
    const { data, error: tenantError } = await localStore.rpc("create_business_tenant", {
      business_name: name.trim(),
      business_slug: normalizedSlug,
    });
    setBusy(false);
    if (tenantError) {
      setError(getErrorMessage(tenantError));
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.tenant_id) {
      setError("The workspace was created without returning its details. Refresh and contact support before retrying.");
      return;
    }
    const newWorkspace = {
      id: row.tenant_id,
      name: row.tenant_name,
      slug: row.tenant_slug,
      role: "owner",
      subscriptionStatus: "active",
    };
    setWorkspace(newWorkspace);
    onWorkspaceCreated(newWorkspace);
  }

  return <AuthLayout admin><div className="auth-card">
    <p className="eyebrow">WORKSPACE SETUP</p><h2>{workspace ? "Your storefront is ready" : "Set up your storefront"}</h2>
    <p className="muted">{workspace ? "Your storefront and 20 rental vehicles are ready." : "Create your rental workspace and start with 20 vehicles ready to list."}</p>
    {workspace && <div className="location-notice">Your storefront: <Link className="text-link" to={`/r/${workspace.slug}`}>{window.location.origin}/r/{workspace.slug}</Link></div>}
    {!workspace && <form className="app-form" onSubmit={submit}>
      <label>Business name<input value={name} onChange={event => {
        const nextName = event.target.value;
        setName(nextName);
        setSlug(nextName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
      }} minLength={2} maxLength={100} required /></label>
      <label>Storefront address<input value={slug} onChange={event => setSlug(event.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={50} required /><small>Your customer booking link will end in /r/{slug || "your-business"}.</small></label>
      {error && <p className="form-message error-message" role="alert">{error}</p>}
      <button className="primary-button full-button" type="submit" disabled={busy}>{busy ? "Creating workspace…" : "Create workspace"}</button>
    </form>}
    {workspace && <Link to="/dashboard" className="primary-button full-button">Open dashboard</Link>}
    <p className="fine-print">Your workspace and bookings are stored in this browser and are not shared across devices.</p>
  </div></AuthLayout>;
}

function LoadingPage() {
  return <PageFrame className="portal-page"><p role="status">Connecting to BB Rentals…</p></PageFrame>;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN");
}

function downloadCsv(filename, headers, rows) {
  const escape = value => {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const csv = "\uFEFF" + [headers, ...rows].map(row => row.map(escape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function UserPaymentsPage({ user, onLogout, appError }) {
  const location = useLocation();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadBookings() {
      const { data, error: queryError } = await localStore
        .from("bookings")
        .select("id,car_name,start_date,end_date,payment_method,total_amount,payment_status,paid_amount,status,created_at")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (queryError) setError(getErrorMessage(queryError));
      else setBookings(data);
      setLoading(false);
    }
    loadBookings();
    return () => { active = false; };
  }, []);

  const summary = useMemo(() => bookings.reduce((result, booking) => {
    const total = Number(booking.total_amount) || 0;
    if (booking.status === "cancelled") return result;
    if (booking.payment_status === "paid") result.paid += Number(booking.paid_amount) || 0;
    else result.pending += total;
    return result;
  }, { paid: 0, pending: 0 }), [bookings]);

  return <><AppShell user={user} onLogout={onLogout} error={appError}>
    <PageFrame className="portal-page">
      <p className="eyebrow">CUSTOMER PORTAL</p><h1>My <span>Bookings</span></h1>
      <p className="muted">Booking and payment details for {user.username}.</p>
      {location.state?.notice && <p className="notice-message">{location.state.notice}</p>}
      <div className="stats-grid">
        <Stat label="Bookings" value={bookings.length} />
        <Stat label="Paid" value={currency.format(summary.paid)} />
        <Stat label="Pending" value={currency.format(summary.pending)} />
      </div>
      <section className="panel">
        <div className="panel-heading"><h2>Rental history</h2><Link to="/cars" className="primary-button compact-button">Browse cars</Link></div>
        {error ? <p className="form-message error-message" role="alert">{error}</p> : loading ? <p className="empty-state" role="status">Loading your bookings…</p> : bookings.length === 0 ? <p className="empty-state">No rentals yet. Browse the fleet to book a car.</p> :
          <div className="table-scroll"><table><thead><tr><th>Car</th><th>Rental dates</th><th>Method</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>{bookings.map(booking => <tr key={booking.id}><td>{booking.car_name}</td><td>{formatDate(booking.start_date)} – {formatDate(booking.end_date)}</td><td>{booking.payment_method}</td><td>{currency.format(Number(booking.total_amount) || 0)}</td><td><span className={`status-pill ${booking.payment_status === "paid" ? "paid" : booking.status === "cancelled" ? "cancelled" : "pending"}`}>{booking.status === "cancelled" ? "Cancelled" : booking.payment_status}</span></td></tr>)}</tbody>
          </table></div>}
        <p className="fine-print">Payments are not processed online. Pending amounts are due at pick-up.</p>
      </section>
    </PageFrame>
    <Footer />
  </AppShell></>;
}

function Stat({ label, value }) {
  return <article className="stat-card"><span>{label}</span><strong>{value}</strong></article>;
}

function AdminPage({ user, tenant, onLogout, appError, onRefreshUser }) {
  const [date, setDate] = useState(getLocalDateInputValue());
  const [bookings, setBookings] = useState([]);
  const [fleet, setFleet] = useState([]);
  const [error, setError] = useState("");
  const [bookingsError, setBookingsError] = useState("");
  const [fleetError, setFleetError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [edits, setEdits] = useState({});
  const [savingCarId, setSavingCarId] = useState("");
  const [newCar, setNewCar] = useState({
    name: "",
    rate: "",
    category: "",
    seats: "5",
    transmission: "Automatic",
    fuel: "Petrol",
    photoTemplateId: carTemplates[0].id,
    description: "",
  });
  const canManageFleet = ["owner", "manager"].includes(tenant.role);

  useEffect(() => {
    let active = true;
    async function loadBookings() {
      const { data, error: queryError } = await localStore
        .from("bookings")
        .select("id,car_id,car_name,customer_name,customer_email,customer_phone,start_date,end_date,daily_rate,total_amount,payment_method,payment_status,paid_amount,status,created_at")
        .eq("tenant_id", tenant.id)
        .lte("start_date", date)
        .gte("end_date", date)
        .neq("status", "cancelled")
        .order("start_date");
      if (!active) return;
      if (queryError) setBookingsError(getErrorMessage(queryError));
      else {
        setBookings(data);
        setBookingsError("");
      }
    }
    loadBookings();
    return () => { active = false; };
  }, [date]);

  useEffect(() => {
    let active = true;
    async function loadFleet() {
      const { data, error: queryError } = await localStore
        .from("cars")
        .select("id,name,rate,is_active")
        .eq("tenant_id", tenant.id)
        .order("name");
      if (!active) return;
      if (queryError) setFleetError(getErrorMessage(queryError));
      else {
        setFleet(data);
        setFleetError("");
        setEdits(Object.fromEntries(data.map(car => [car.id, {
          rate: String(car.rate),
          is_active: car.is_active,
        }])));
      }
    }
    loadFleet();
    return () => { active = false; };
  }, []);

  const collected = bookings.reduce((sum, item) => item.payment_status === "paid"
    ? sum + (Number(item.paid_amount) || 0) : sum, 0);
  const pending = bookings.reduce((sum, item) => item.payment_status === "paid"
    ? sum : sum + (Number(item.total_amount) || 0), 0);

  async function updatePayment(booking) {
    const paymentStatus = booking.payment_status === "paid" ? "pending" : "paid";
    setSavingId(booking.id);
    setError("");
    const { data, error: updateError } = await localStore
      .from("bookings")
      .update({
        payment_status: paymentStatus,
        paid_amount: paymentStatus === "paid" ? Number(booking.total_amount) : 0,
      })
      .eq("id", booking.id)
      .eq("tenant_id", tenant.id)
      .select("id,payment_status,paid_amount")
      .single();
    setSavingId("");
    if (updateError) {
      setError(getErrorMessage(updateError));
      return;
    }
    setBookings(current => current.map(item => item.id === data.id
      ? { ...item, payment_status: data.payment_status, paid_amount: data.paid_amount }
      : item));
  }

  async function saveCar(car) {
    const edit = edits[car.id];
    const rate = Number(edit?.rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      setError("Enter a valid daily rental price greater than zero.");
      return;
    }
    setSavingCarId(car.id);
    setError("");
    const { data, error: updateError } = await localStore
      .from("cars")
      .update({ rate, is_active: edit.is_active })
      .eq("id", car.id)
      .eq("tenant_id", tenant.id)
      .select("*")
      .single();
    setSavingCarId("");
    if (updateError) {
      setError(getErrorMessage(updateError));
      return;
    }
    setFleet(current => current.map(item => item.id === data.id ? data : item));
    setEdits(current => ({
      ...current,
      [data.id]: { rate: String(data.rate), is_active: data.is_active },
    }));
  }

  async function addCar(event) {
    event.preventDefault();
    const rate = Number(newCar.rate);
    const seats = Number(newCar.seats);
    if (!newCar.name.trim() || !newCar.category.trim() || !Number.isFinite(rate) || rate <= 0 ||
      !Number.isInteger(seats) || seats <= 0) {
      setError("Enter a car name, category, valid daily rate, and positive whole-number seat count.");
      return;
    }
    const photoTemplate = carTemplates.find(car => car.id === newCar.photoTemplateId);
    if (!photoTemplate) {
      setError("Choose a valid stock photo.");
      return;
    }
    const idBase = newCar.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const carRecord = {
      id: `${idBase || "car"}-${crypto.randomUUID().slice(0, 8)}`,
      tenant_id: tenant.id,
      name: newCar.name.trim(),
      rate,
      category: newCar.category.trim(),
      seats,
      transmission: newCar.transmission,
      fuel: newCar.fuel,
      image: photoTemplate.image,
      second_image: photoTemplate.secondImage,
      description: newCar.description.trim(),
    };
    setSavingCarId("new");
    setError("");
    const { data, error: insertError } = await localStore
      .from("cars")
      .insert(carRecord)
      .select("id,name,rate,is_active")
      .single();
    setSavingCarId("");
    if (insertError) {
      setError(getErrorMessage(insertError));
      return;
    }
    setFleet(current => [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
    setEdits(current => ({ ...current, [data.id]: { rate: String(data.rate), is_active: data.is_active } }));
    setNewCar(current => ({ ...current, name: "", rate: "", category: "", description: "" }));
  }

  const exportRows = (records, payment = false) => {
    const headers = payment
      ? ["Booking", "Car", "Customer", "Customer email", "Payment method", "Amount INR", "Payment status"]
      : ["Booking", "Car", "Customer", "Customer email", "Phone", "Start date", "End date", "Daily rate INR", "Total INR", "Status"];
    const rows = records.map(item => payment
      ? [item.id, item.car_name, item.customer_name, item.customer_email, item.payment_method, item.total_amount, item.payment_status]
      : [item.id, item.car_name, item.customer_name, item.customer_email, item.customer_phone, item.start_date, item.end_date, item.daily_rate, item.total_amount, item.status]);
    downloadCsv(payment ? `bb-rentals-payments-${date}.csv` : `bb-rentals-${date}.csv`, headers, rows);
  };

  return <><AppShell user={user} onLogout={onLogout} error={appError}>
    <PageFrame className="portal-page">
      <p className="eyebrow">ADMIN MODULE</p><h1>Rental <span>Dashboard</span></h1>
      <p className="muted">Manage {tenant.name}'s reservations, fleet, and pay-at-pickup collections.</p>
      <section className="panel subscription-panel">
        <div className="panel-heading"><div><p className="eyebrow">PUBLIC STOREFRONT</p><h2>{tenant.name}</h2></div></div>
        <div className="subscription-actions">
          <div><p>Customer storefront address</p><Link className="text-link" to={`/r/${tenant.slug}`}>{window.location.origin}/r/{tenant.slug}</Link></div>
          <div className="subscription-buttons">
            <button className="outline-button" type="button" onClick={onRefreshUser}>Refresh local data</button>
          </div>
        </div>
        <p className="fine-print">Workspace information and bookings are stored in this browser.</p>
      </section>
      <div className="report-controls"><label>Report date<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><p>Bookings are saved in this browser.</p></div>
      {[error, bookingsError, fleetError].filter(Boolean).map(message => <p key={message} className="form-message error-message" role="alert">{message}</p>)}
      <div className="stats-grid">
        <Stat label="Cars rented" value={bookings.length} />
        <Stat label="Daily rental amount" value={currency.format(bookings.reduce((sum, item) => sum + (Number(item.daily_rate) || 0), 0))} />
        <Stat label="Bookings" value={bookings.length} />
      </div>
      <section className="panel">
        <div className="panel-heading"><h2>Rentals</h2><button className="primary-button compact-button" onClick={() => exportRows(bookings)}>Export rentals</button></div>
        {bookings.length === 0 ? <p className="empty-state">No rentals for this date.</p> :
          <div className="table-scroll"><table><thead><tr><th>Car</th><th>Customer</th><th>Dates</th><th>Amount / day</th><th>Total</th><th>Payment</th></tr></thead>
            <tbody>{bookings.map(item => <tr key={item.id}><td>{item.car_name}</td><td>{item.customer_name}<small className="cell-subtitle">{item.customer_email}<br />{item.customer_phone}</small></td><td>{formatDate(item.start_date)} – {formatDate(item.end_date)}</td><td>{currency.format(Number(item.daily_rate) || 0)}</td><td>{currency.format(Number(item.total_amount) || 0)}</td><td>{canManageFleet ? <button className={`status-button ${item.payment_status}`} type="button" disabled={savingId === item.id} onClick={() => updatePayment(item)}>{savingId === item.id ? "Saving…" : item.payment_status === "paid" ? "Mark pending" : "Mark paid"}</button> : item.payment_status}</td></tr>)}</tbody>
          </table></div>}
      </section>
      <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">PAYMENT SUMMARY</p><h2>Payments</h2></div><button className="outline-button" onClick={() => exportRows(bookings, true)}>Export payments</button></div>
        <div className="stats-grid compact-stats"><Stat label="Collected" value={currency.format(collected)} /><Stat label="Pending" value={currency.format(pending)} /><Stat label="Payment records" value={bookings.length} /></div>
        {bookings.length === 0 && <p className="empty-state">No payment records for this date.</p>}
      </section>
      <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">FLEET MANAGEMENT</p><h2>Cars and daily rates</h2></div></div>
        {canManageFleet && <form className="vehicle-form" onSubmit={addCar}>
          <h3>Add a vehicle</h3>
          <div className="form-grid">
            <label>Vehicle name<input required value={newCar.name} onChange={event => setNewCar(current => ({ ...current, name: event.target.value }))} /></label>
            <label>Daily rate (INR)<input required type="number" min="1" step="1" value={newCar.rate} onChange={event => setNewCar(current => ({ ...current, rate: event.target.value }))} /></label>
            <label>Category<input required value={newCar.category} onChange={event => setNewCar(current => ({ ...current, category: event.target.value }))} /></label>
            <label>Seats<input required type="number" min="1" step="1" value={newCar.seats} onChange={event => setNewCar(current => ({ ...current, seats: event.target.value }))} /></label>
            <label>Transmission<select value={newCar.transmission} onChange={event => setNewCar(current => ({ ...current, transmission: event.target.value }))}><option>Automatic</option><option>Manual</option></select></label>
            <label>Fuel<input required value={newCar.fuel} onChange={event => setNewCar(current => ({ ...current, fuel: event.target.value }))} /></label>
            <label>Stock photo<select value={newCar.photoTemplateId} onChange={event => setNewCar(current => ({ ...current, photoTemplateId: event.target.value }))}>{carTemplates.map(car => <option value={car.id} key={car.id}>{car.name}</option>)}</select></label>
            <label>Description<input value={newCar.description} onChange={event => setNewCar(current => ({ ...current, description: event.target.value }))} /></label>
          </div>
          <button className="primary-button compact-button" type="submit" disabled={savingCarId === "new"}>{savingCarId === "new" ? "Adding…" : "Add vehicle"}</button>
        </form>}
        {fleet.length === 0 ? <p className="empty-state">No cars found. Add your first vehicle above.</p> :
          <div className="table-scroll"><table><thead><tr><th>Car</th><th>Daily rate (INR)</th><th>Availability</th><th>Action</th></tr></thead>
            <tbody>{fleet.map(car => <tr key={car.id}><td>{car.name}</td><td>{canManageFleet ? <input className="table-input" type="number" min="1" step="1" value={edits[car.id]?.rate ?? car.rate} onChange={event => setEdits(current => ({ ...current, [car.id]: { ...current[car.id], rate: event.target.value } }))} aria-label={`${car.name} daily rate`} /> : currency.format(Number(car.rate))}</td><td>{canManageFleet ? <select className="table-input" value={String(edits[car.id]?.is_active ?? car.is_active)} onChange={event => setEdits(current => ({ ...current, [car.id]: { ...current[car.id], is_active: event.target.value === "true" } }))} aria-label={`${car.name} availability`}><option value="true">Available</option><option value="false">Unavailable</option></select> : car.is_active ? "Available" : "Unavailable"}</td><td>{canManageFleet && <button className="outline-button compact-button" type="button" disabled={savingCarId === car.id} onClick={() => saveCar(car)}>{savingCarId === car.id ? "Saving…" : "Save"}</button>}</td></tr>)}</tbody>
          </table></div>}
      </section>
      <p className="fine-print">Payments are recorded manually at pick-up; this app does not process online payments.</p>
    </PageFrame>
    <Footer />
  </AppShell></>;
}

export default function App() {
  const [auth, setAuth] = useState({ loading: true, user: null, error: "" });
  const [appError, setAppError] = useState("");

  useEffect(() => {
    let active = true;
    let revision = 0;
    async function syncSession(session) {
      const currentRevision = ++revision;
      if (!session) {
        setAuth({ loading: false, user: null, error: "" });
        return;
      }
      if (!active || currentRevision !== revision) return;
      try {
        const user = await loadUserContext(session.user.id, session.user.user_metadata || {});
        if (!active || currentRevision !== revision) return;
        setAuth({ loading: false, user, error: "" });
      } catch (error) {
        if (!active || currentRevision !== revision) return;
        setAuth({
          loading: false,
          user: null,
          error: `Could not load your account: ${getErrorMessage(error)}`,
        });
      }
    }

    const { data: authListener } = localStore.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        if (active) syncSession(session);
      }, 0);
    });

    localStore.auth.getSession().then(({ data, error }) => {
      if (!active || revision > 0) return;
      if (error) {
        setAuth({ loading: false, user: null, error: getErrorMessage(error) });
      } else {
        syncSession(data.session);
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    const { error } = await localStore.auth.signOut();
    if (error) setAppError(getErrorMessage(error));
    else setAppError("");
  }

  function setAuthenticatedUser(user) {
    setAuth({ loading: false, user, error: "" });
  }

  function setCreatedWorkspace(workspace) {
    setAuth(current => ({
      ...current,
      user: current.user ? {
        ...current.user,
        tenant: workspace,
        memberships: [...current.user.memberships.filter(item => item.id !== workspace.id), workspace],
      } : current.user,
    }));
  }

  async function refreshUser() {
    const { data, error } = await localStore.auth.getSession();
    if (error) {
      setAppError(getErrorMessage(error));
      return;
    }
    if (!data.session) {
      setAuth({ loading: false, user: null, error: "" });
      return;
    }
    try {
      const user = await loadUserContext(data.session.user.id, data.session.user.user_metadata || {});
      setAuth({ loading: false, user, error: "" });
      setAppError("");
    } catch (profileError) {
      setAppError(getErrorMessage(profileError));
    }
  }

  if (auth.loading) return <LoadingPage />;

  const user = auth.user;
  const customerOnly = element => user && !user.tenant
    ? element
    : user?.tenant ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
  const businessOnly = element => user?.tenant
    ? element
    : user?.accountType === "business" ? <Navigate to="/business/setup" replace /> : <Navigate to="/business/login" replace />;

  return <>
    {auth.error && <div className="app-alert" role="alert">{auth.error} <button type="button" className="inline-button" onClick={logout}>Sign out</button></div>}
    <Routes>
      <Route path="/" element={<AppShell user={user} onLogout={logout} error={appError}><HomePage user={user} /></AppShell>} />
      <Route path="/rentals" element={<RentalCompaniesPage user={user} onLogout={logout} />} />
      <Route path="/r/:tenantSlug" element={<RentalStorefront user={user} onLogout={logout} />} />
      <Route path="/r/:tenantSlug/cars/:carId" element={<RentalCarDetails user={user} onLogout={logout} />} />
      <Route path="/cars" element={<Navigate to="/rentals" replace />} />
      <Route path="/cars/:carId" element={<Navigate to="/rentals" replace />} />
      <Route path="/about" element={<AppShell user={user} onLogout={logout} error={appError}><AboutPage /><Footer /></AppShell>} />
      <Route path="/login" element={user ? <Navigate to={user.tenant ? "/dashboard" : "/"} replace /> : <LoginPage onAuthenticated={setAuthenticatedUser} />} />
      <Route path="/signup" element={user ? <Navigate to={user.tenant ? "/dashboard" : "/"} replace /> : <SignupPage onAuthenticated={setAuthenticatedUser} />} />
      <Route path="/business/signup" element={user ? <Navigate to={user.tenant ? "/dashboard" : "/business/setup"} replace /> : <SignupPage business onAuthenticated={setAuthenticatedUser} />} />
      <Route path="/business/login" element={user?.tenant ? <Navigate to="/dashboard" replace /> : <LoginPage expectedRole="business" onAuthenticated={setAuthenticatedUser} />} />
      <Route path="/business/setup" element={!user ? <Navigate to="/business/login" replace /> : user.tenant ? <Navigate to="/dashboard" replace /> : user.accountType === "business" ? <BusinessSetupPage user={user} onWorkspaceCreated={setCreatedWorkspace} /> : <Navigate to="/business/signup" replace />} />
      <Route path="/dashboard" element={businessOnly(<AdminPage user={user} tenant={user?.tenant} onLogout={logout} appError={appError} onRefreshUser={refreshUser} />)} />
      <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
      <Route path="/admin/login" element={<Navigate to="/business/login" replace />} />
      <Route path="/payments" element={customerOnly(<UserPaymentsPage user={user} onLogout={logout} appError={appError} />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </>;
}

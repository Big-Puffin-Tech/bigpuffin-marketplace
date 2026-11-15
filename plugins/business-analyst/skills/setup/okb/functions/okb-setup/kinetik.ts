// Kinetik's own details, which setup needs and no client gives: each member of Kinetik's staff who works in a
// business's project, by name and work email address; the address okb-setup sends each of their one-time invitation codes
// to; and the address an owner writes to when setup fails before they have signed in. Kinetik's staff keep this
// list. okb-setup makes a one-time invitation code for each, and first-administrator.sql makes each one an actor named
// "<name> (Kinetik)" with the kinetik access template. okb-setup sends each code to ACCESS_URL. A code it could
// not send goes in the setup summary instead, for the owner to email to its address. An empty list leaves the owner an
// open task, "Add Kinetik", which the business analyst's invite_person completes later.
export const STAFF: { name: string; email: string }[] = [{ name: "Support", email: "support@kinetik.it.com" }];

/** Kinetik's website, which takes each code okb-setup makes for Kinetik's staff, or null to send none. */
export const ACCESS_URL: string | null = "https://kinetik.it.com/api/access";

/** The address an owner writes to when setup fails before they can raise a support request, or null. */
export const SUPPORT_EMAIL: string | null = "support@kinetik.it.com";

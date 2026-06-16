// Supabase Database types — hand-maintained. Phase 32 hygiene.
//
// Why this file exists:
//   - `npx supabase gen types typescript --project-id …` needs an
//     access token; the project owner hasn't generated one yet.
//   - The default supabase-js type for `.from("products")` etc. is
//     `never`, which means every `.data` access in route handlers
//     pulls a TS error like `Property 'title_en' does not exist on
//     type 'never'`. There are ~400 of these across the codebase —
//     runtime-fine, but they drown the real errors.
//
//   Adding this file + wiring `GenericTable` into `getServiceRoleClient`
//   removes the `never` inference across the whole codebase. The
//   `Database` shape follows the standard supabase-js convention
//   (`public.Tables.<name>.Row/Insert/Update`).
//
// How to keep it accurate:
//   When a migration changes a column, update the matching table
//   here in the same commit. Or, when the operator can supply a
//   `SUPABASE_ACCESS_TOKEN`, swap this for the generated file:
//     npx supabase gen types typescript --project-id xgudiwguopfxqiwofkuz
//     > src/lib/supabase/database.types.ts
//
// Last synced: 2026-06-15 (Phase 32.3 — TS noise pass)
//   18 tables: addresses, ai_runs, contact_messages, discovered_products,
//   newsletter_subscribers, notifications, order_items, orders, page_views,
//   price_alert_log, price_history, price_tiers, products, profiles, quotes,
//   rfqs, sync_runs, watchlist

type Numeric = number;
type Bigint = number; // supabase-js returns bigint as number in JS
type Timestamp = string;
type Uuid = string;

export type Database = {
  public: {
    Tables: {
      addresses: {
        Row: {
          id: number;
          user_id: Uuid;
          label: string;
          full_name: string;
          phone: string;
          country: string;
          district: string;
          address_line: string;
          is_default: boolean;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: number;
          user_id: Uuid;
          label: string;
          full_name: string;
          phone: string;
          country: string;
          district: string;
          address_line: string;
          is_default?: boolean;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["addresses"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "profiles_implicit_user_id", columns: ["user_id"], referencedRelation: "profiles", referencedColumns: ["id"] },
        ],
      };
      ai_runs: {
        Row: {
          id: Uuid;
          kind: string;
          model: string;
          source_table: string | null;
          source_id: string | null;
          source_hash: string | null;
          input_tokens: number;
          output_tokens: number;
          cost_usd: Numeric;
          output: unknown; // jsonb
          created_at: Timestamp;
        };
        Insert: {
          id?: Uuid;
          kind: string;
          model: string;
          source_table?: string | null;
          source_id?: string | null;
          source_hash?: string | null;
          input_tokens: number;
          output_tokens: number;
          cost_usd: Numeric;
          output: unknown;
          created_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["ai_runs"]["Insert"]>;
        Relationships: [],
      };
      contact_messages: {
        Row: {
          id: number;
          user_id: Uuid | null;
          name: string;
          phone: string;
          email: string | null;
          company: string | null;
          message: string;
          source: string;
          status: string;
          ip_hash: string | null;
          admin_owner_id: Uuid | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["contact_messages"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: number;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["contact_messages"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "profiles_implicit_user_id", columns: ["user_id"], referencedRelation: "profiles", referencedColumns: ["id"] },
        ],
      };
      discovered_products: {
        Row: {
          id: number;
          offer_id: string;
          title_zh: string;
          title_en: string | null;
          category: string | null;
          factory_moq: number | null;
          price_tiers: unknown | null;
          images: unknown | null;
          supplier_name: string | null;
          supplier_province: string | null;
          supplier_city: string | null;
          badges: unknown | null;
          source_url: string | null;
          raw_response: unknown | null;
          status: string;
          discovered_at: Timestamp;
          reviewed_at: Timestamp | null;
          reviewer_note: string | null;
          source_keyword: string | null;
          product_id: number | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["discovered_products"]["Row"],
          "id" | "discovered_at"
        > & {
          id?: number;
          discovered_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["discovered_products"]["Insert"]>;
        Relationships: [],
      };
      newsletter_subscribers: {
        Row: {
          id: number;
          email: string;
          source: string | null;
          ip_hash: string | null;
          created_at: Timestamp;
          confirm_token: string | null;
          confirmed_at: Timestamp | null;
          unsubscribed_at: Timestamp | null;
        };
        Insert: {
          id?: number;
          email: string;
          source?: string | null;
          ip_hash?: string | null;
          created_at?: Timestamp;
          confirm_token?: string | null;
          confirmed_at?: Timestamp | null;
          unsubscribed_at?: Timestamp | null;
        };
        Update: Partial<Database["public"]["Tables"]["newsletter_subscribers"]["Insert"]>;
        Relationships: [],
      };
      notifications: {
        Row: {
          id: number;
          user_id: Uuid;
          kind: string;
          title: string;
          body: string | null;
          href: string | null;
          related_alert_id: number | null;
          related_product_id: number | null;
          read_at: Timestamp | null;
          created_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["notifications"]["Row"],
          "id" | "created_at"
        > & {
          id?: number;
          created_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "profiles_implicit_user_id", columns: ["user_id"], referencedRelation: "profiles", referencedColumns: ["id"] },
        ],
      };
      order_items: {
        Row: {
          id: number;
          order_id: number;
          product_id: number | null;
          qty: number;
          title_snapshot: string;
          image_snapshot: string | null;
          unit_cny_fen: Bigint;
          fx_cny_to_bdt: Numeric;
          markup_pct: Numeric;
          weight_kg: Numeric;
          volume_cbm: Numeric;
          category: string | null;
          customs_duty_per_kg: Numeric;
          unit_bdt: Numeric;
          line_bdt: Numeric;
          line_duty_bdt: Numeric;
          position: number;
        };
        Insert: Omit<
          Database["public"]["Tables"]["order_items"]["Row"],
          "id"
        > & { id?: number };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "products_implicit_product_id", columns: ["product_id"], referencedRelation: "products", referencedColumns: ["id"] },
        ],
      };
      orders: {
        Row: {
          id: number;
          user_id: Uuid;
          status: string;
          shipping_mode: string;
          product_subtotal_bdt: Numeric;
          shipping_bdt: Numeric;
          duty_bdt: Numeric;
          vat_bdt: Numeric;
          ait_bdt: Numeric;
          total_bdt: Numeric;
          deposit_bdt: Numeric;
          balance_bdt: Numeric;
          paid_at: Timestamp | null;
          payment_method: string;
          address_snapshot: unknown | null;
          buyer_note: string | null;
          tracking_number: string | null;
          internal_note: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
          payment_model: string;
          address_id: number | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["orders"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: number;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
        Relationships: [],
      };
      page_views: {
        Row: {
          id: number;
          path: string;
          referrer: string | null;
          user_agent: string | null;
          session_id: string | null;
          country: string | null;
          recorded_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["page_views"]["Row"],
          "id" | "recorded_at"
        > & {
          id?: number;
          recorded_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["page_views"]["Insert"]>;
        Relationships: [],
      };
      price_history: {
        Row: {
          id: number;
          product_id: number;
          source_id: string;
          qty_min: number;
          qty_max: number | null;
          old_price_cny_fen: number | null;
          new_price_cny_fen: number;
          change_pct: Numeric | null;
          sync_run_id: Uuid;
          source: string;
          recorded_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["price_history"]["Row"],
          "id" | "recorded_at" | "source" | "sync_run_id"
        > & {
          id?: number;
          recorded_at?: Timestamp;
          source?: string;
          sync_run_id?: Uuid;
        };
        Update: Partial<Database["public"]["Tables"]["price_history"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "products_implicit_product_id", columns: ["product_id"], referencedRelation: "products", referencedColumns: ["id"] },
        ],
      };
      price_alert_log: {
        Row: {
          id: number;
          product_id: number;
          source_id: string;
          qty_min: number;
          qty_max: number | null;
          old_price_cny_fen: number;
          new_price_cny_fen: number;
          change_pct: Numeric;
          direction: string;
          detected_at: Timestamp;
          notified_at: Timestamp | null;
          acknowledged_at: Timestamp | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["price_alert_log"]["Row"],
          "id"
        > & { id?: number };
        Update: Partial<Database["public"]["Tables"]["price_alert_log"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "products_implicit_product_id", columns: ["product_id"], referencedRelation: "products", referencedColumns: ["id"] },
        ],
      };
      price_tiers: {
        Row: {
          id: number;
          product_id: number;
          qty_min: number;
          qty_max: number | null;
          price_cny_fen: number;
        };
        Insert: Omit<
          Database["public"]["Tables"]["price_tiers"]["Row"],
          "id"
        > & { id?: number };
        Update: Partial<Database["public"]["Tables"]["price_tiers"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "products_implicit_product_id", columns: ["product_id"], referencedRelation: "products", referencedColumns: ["id"] },
        ],
      };
      products: {
        Row: {
          id: number;
          source_id: string;
          title_zh: string;
          title_en: string;
          title_bn: string;
          category: string;
          factory_moq: number;
          weight_kg: Numeric;
          volume_cbm: Numeric;
          markup_pct: Numeric;
          quality_score: Numeric | null;
          supplier_name: string;
          supplier_province: string;
          supplier_city: string;
          stock_total: number;
          order_count_30d: number;
          rating_overall: Numeric;
          badges: string[];
          images: string[];
          description_en: string;
          description_bn: string;
          source_url: string;
          active: boolean;
          created_at: Timestamp;
          updated_at: Timestamp;
          customs_duty_per_kg: Numeric;
          customs_duty_class: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["products"]["Row"],
          "id" | "created_at" | "updated_at" | "stock_total" | "order_count_30d" | "rating_overall" | "badges" | "images" | "active"
        > & {
          id?: number;
          stock_total?: number;
          order_count_30d?: number;
          rating_overall?: Numeric;
          badges?: string[];
          images?: string[];
          active?: boolean;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [],
      };
      profiles: {
        Row: {
          id: Uuid;
          email: string;
          full_name: string | null;
          company: string | null;
          phone: string | null;
          country: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
          is_admin: boolean;
        };
        Insert: {
          id: Uuid;
          email: string;
          full_name?: string | null;
          company?: string | null;
          phone?: string | null;
          country?: string | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
          is_admin?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [],
      };
      quotes: {
        Row: {
          id: Uuid;
          user_id: Uuid;
          quote_id: string;
          product_ids: string[];
          shipping_mode: string;
          total_qty: number;
          fob_cny_fen: Bigint;
          fx_cny_bdt: Numeric;
          cn_subtotal_bdt: Bigint;
          intl_bdt: Bigint;
          agent_bdt: Bigint;
          consol_bdt: Bigint;
          duty_bdt: Bigint;
          duty_pct: Numeric;
          vat_bdt: Bigint;
          ait_bdt: Bigint;
          markup_bdt: Bigint;
          markup_pct: Numeric;
          total_bdt: Bigint;
          unit_bdt: Bigint;
          chargeable_kg: Numeric;
          transit_days: string;
          status: string;
          notes: string | null;
          expires_at: Timestamp;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["quotes"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: Uuid;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["quotes"]["Insert"]>;
        Relationships: [],
      };
      rfqs: {
        Row: {
          id: number;
          user_id: Uuid;
          title: string;
          spec_text: string;
          target_qty: number;
          target_price_cny_fen: Bigint | null;
          image_urls: string[];
          destination_country: string;
          notes: string | null;
          status: string;
          quoted_price_cny_fen: Bigint | null;
          quoted_min_qty: number | null;
          quoted_lead_days: number | null;
          quoted_notes: string | null;
          quoted_at: Timestamp | null;
          closed_at: Timestamp | null;
          admin_owner_id: Uuid | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["rfqs"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: number;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["rfqs"]["Insert"]>;
        Relationships: [],
      };
      sync_runs: {
        Row: {
          id: Uuid;
          source: string;
          trigger: string;
          started_at: Timestamp;
          finished_at: Timestamp | null;
          products_seen: number | null;
          products_changed: number | null;
          products_added: number | null;
          products_removed: number | null;
          tiers_changed: number | null;
          api_cost_usd: Numeric | null;
          error: string | null;
          metadata: unknown | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["sync_runs"]["Row"],
          "id" | "started_at"
        > & {
          id?: Uuid;
          started_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["sync_runs"]["Insert"]>;
        Relationships: [],
      };
      watchlist: {
        Row: {
          id: number;
          user_id: Uuid;
          product_id: number;
          saved_at: Timestamp;
          notify_on_drop: boolean;
        };
        Insert: Omit<
          Database["public"]["Tables"]["watchlist"]["Row"],
          "id" | "saved_at"
        > & {
          id?: number;
          saved_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["watchlist"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "products_implicit_product_id", columns: ["product_id"], referencedRelation: "products", referencedColumns: ["id"] },
        ],
      };
      group_buys: {
        Row: {
          id: Uuid;
          product_id: number;
          target_qty: number;
          min_qty_per_buyer: number;
          // jsonb Array<{qty_threshold:number, unit_bdt:number}>.
          // Validated shape is enforced in pricing.ts
          // (validateGroupBuyTiers) and at the DB CHECK constraint.
          price_tiers: unknown;
          deadline_at: Timestamp;
          status: string;
          final_unit_bdt: number | null;
          created_by: Uuid;
          created_at: Timestamp;
          formed_at: Timestamp | null;
          cancelled_at: Timestamp | null;
          updated_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["group_buys"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: Uuid;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["group_buys"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "group_buys_product_id_fkey", columns: ["product_id"], referencedRelation: "products", referencedColumns: ["id"] },
        ];
      };
      group_buy_members: {
        Row: {
          id: Uuid;
          group_buy_id: Uuid;
          user_id: Uuid;
          qty: number;
          unit_bdt_at_commit: number;
          payment_state: string;
          order_id: number | null;
          created_at: Timestamp;
          charged_at: Timestamp | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["group_buy_members"]["Row"],
          "id" | "created_at"
        > & {
          id?: Uuid;
          created_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["group_buy_members"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "group_buy_members_group_buy_id_fkey", columns: ["group_buy_id"], referencedRelation: "group_buys", referencedColumns: ["id"] },
          { foreignKeyName: "group_buy_members_order_id_fkey", columns: ["order_id"], referencedRelation: "orders", referencedColumns: ["id"] },
          { foreignKeyName: "profiles_implicit_user_id", columns: ["user_id"], referencedRelation: "profiles", referencedColumns: ["id"] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_order_with_items: {
        Args: {
          p_user_id: string;
          p_shipping_mode: string;
          p_payment_method: string;
          p_product_subtotal_bdt: number;
          p_shipping_bdt: number;
          p_duty_bdt: number;
          p_vat_bdt: number;
          p_ait_bdt: number;
          p_total_bdt: number;
          p_deposit_bdt: number;
          p_balance_bdt: number;
          p_address_id: number | null;
          p_address_snapshot: unknown;
          p_buyer_note: string | null;
          p_items: Array<{
            product_id: number;
            qty: number;
            title_snapshot: string;
            image_snapshot: string | null;
            unit_cny_fen: number;
            fx_cny_to_bdt: number;
            markup_pct: number;
            weight_kg: number;
            volume_cbm: number;
            category: string | null;
            customs_duty_per_kg: number;
            unit_bdt: number;
            line_bdt: number;
            line_duty_bdt: number;
            position: number;
          }>;
        };
        Returns: number;
      };
      popular_by_views: {
        Args: { p_since: string; p_limit: number };
        Returns: Array<{
          product_id: number;
          source_id: string;
          view_count: number;
        }>;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

// Supabase client generic: when typed with `Database`, `.from("products")`
// returns `Product[]` instead of `never[]`. Wire it up in
// `src/lib/supabase/server.ts` + `browser.ts`:
//   createClient<Database>(...)
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Inserts<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type Updates<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// Relationship declarations for supabase-js's embedded-resource
// syntax (`.select("..., parent_table(col, col)")`). Without these,
// TS can't infer the foreign-key join and falls back to `never`.
// Each entry: { foreignKeyName, columns, referencedRelation, referencedColumns }
//   - `foreignKeyName`: matches a real FK constraint in the DB
//   - `columns`: local column(s)
//   - `referencedRelation`: the parent table
//   - `referencedColumns`: parent column(s)
// These are the relationships that the public schema actually
// uses (verified via pg_constraint queries during Phase 33).
type Relationship = {
  foreignKeyName: string;
  columns: string[];
  referencedRelation: string;
  referencedColumns: string[];
};

// Manually-declared relationships for the embedded-resource syntax
// (`.select("..., price_tiers(col, col)")`). The public schema has
// no FK constraints (verified Phase 33), so supabase-js can't
// infer the joins from the DB. We declare them here so the TS
// types resolve to the right shape.
const PRODUCTS_REL: Relationship = {
  foreignKeyName: "products_implicit_product_id",
  columns: ["product_id"],
  referencedRelation: "products",
  referencedColumns: ["id"],
};
const PROFILES_REL: Relationship = {
  foreignKeyName: "profiles_implicit_user_id",
  columns: ["user_id"],
  referencedRelation: "profiles",
  referencedColumns: ["id"],
};
const ORDERS_REL: Relationship = {
  foreignKeyName: "orders_implicit_user_id",
  columns: ["user_id"],
  referencedRelation: "orders",
  referencedColumns: ["id"],
};
const ADDRESSES_REL: Relationship = {
  foreignKeyName: "addresses_implicit_user_id",
  columns: ["user_id"],
  referencedRelation: "addresses",
  referencedColumns: ["id"],
};

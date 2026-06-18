export default function BuyerSettingsPage() {
  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <div className="mb-8">
        <p className="text-[12px] font-medium tracking-wider uppercase text-fg-subtle">
          Account
        </p>
        <h1 className="mt-2 text-[32px] md:text-[40px] leading-[1.05] font-semibold tracking-[-0.02em]">
          Settings
        </h1>
        <p className="mt-3 text-[14px] text-fg-muted">
          Account-level preferences. Currency, language, notifications,
          data export.
        </p>
      </div>

      <section className="card divide-y divide-border">
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium">Display currency</p>
            <p className="text-[11px] text-fg-muted mt-0.5">
              How prices render in catalog and quotes
            </p>
          </div>
          <select
            defaultValue="BDT"
            className="text-[13px] px-2 py-1.5 rounded-md border border-border bg-bg"
          >
            <option value="BDT">BDT (Taka)</option>
            <option value="CNY">CNY (Yuan)</option>
            <option value="USD">USD (Dollar)</option>
          </select>
        </div>
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium">Language</p>
            <p className="text-[11px] text-fg-muted mt-0.5">
              Site language for emails and notifications
            </p>
          </div>
          <select
            defaultValue="en"
            className="text-[13px] px-2 py-1.5 rounded-md border border-border bg-bg"
          >
            <option value="en">English</option>
            <option value="bn">বাংলা</option>
          </select>
        </div>
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium">Email notifications</p>
            <p className="text-[11px] text-fg-muted mt-0.5">
              Quote status changes, price alerts on saved products
            </p>
          </div>
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              defaultChecked
              className="sr-only peer"
            />
            <div className="w-9 h-5 rounded-full bg-bg-soft peer-checked:bg-emerald-500 relative transition-colors">
              <div className="absolute top-0.5 left-0.5 w-4 heading-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
            </div>
          </label>
        </div>
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium">WhatsApp updates</p>
            <p className="text-[11px] text-fg-muted mt-0.5">
              Real-time shipping status
            </p>
          </div>
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              defaultChecked
              className="sr-only peer"
            />
            <div className="w-9 h-5 rounded-full bg-bg-soft peer-checked:bg-emerald-500 relative transition-colors">
              <div className="absolute top-0.5 left-0.5 w-4 heading-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
            </div>
          </label>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[18px] font-semibold tracking-tight mb-3">Data</h2>
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium">Export all my data</p>
            <p className="text-[11px] text-fg-muted mt-0.5">
              JSON download of every quote, RFQ, profile field
            </p>
          </div>
          <button className="px-3 py-1.5 text-[12px] border border-border rounded-md text-fg-muted hover:text-fg">
            Download
          </button>
        </div>
      </section>
    </div>
  );
}

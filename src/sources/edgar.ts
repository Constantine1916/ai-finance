import { requestJson } from "./http";

// SEC EDGAR：申报列表与 XBRL 财务数据。请求需声明 User-Agent，频率低于每秒 10 次。

export interface Fact {
  start?: string;
  end: string;
  val: number;
  accn: string;
  fy?: number;
  fp?: string;
  form: string;
  filed: string;
}

export interface CompanyFacts {
  cik: number;
  entityName: string;
  facts: Record<string, Record<string, { units: Record<string, Fact[]> }>>;
}

export interface Filing {
  accessionNumber: string;
  form: string;
  filingDate: string;
  reportDate: string;
  primaryDocument: string;
}

let lastRequest = 0;
const MIN_INTERVAL_MS = 150; // 约每秒 6～7 次，低于 SEC 上限

async function throttle() {
  const wait = lastRequest + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
}

const pad10 = (cik: string | number) => String(Number(cik)).padStart(10, "0");

export async function fetchCompanyFacts(cik: string, userAgent: string, signal: AbortSignal) {
  await throttle();
  return requestJson<CompanyFacts>("SEC EDGAR", `https://data.sec.gov/api/xbrl/companyfacts/CIK${pad10(cik)}.json`, { signal, headers: { "User-Agent": userAgent } });
}

export async function fetchFilings(cik: string, userAgent: string, signal: AbortSignal): Promise<Filing[]> {
  await throttle();
  const body = await requestJson<{ filings: { recent: Record<string, string[]> } }>("SEC EDGAR", `https://data.sec.gov/submissions/CIK${pad10(cik)}.json`, { signal, headers: { "User-Agent": userAgent } });
  const r = body.filings.recent;
  return (r.accessionNumber ?? []).map((accessionNumber, i) => ({
    accessionNumber,
    form: r.form![i]!,
    filingDate: r.filingDate![i]!,
    reportDate: r.reportDate![i]!,
    primaryDocument: r.primaryDocument![i]!,
  }));
}

export async function fetchTickerDirectory(userAgent: string, signal: AbortSignal) {
  await throttle();
  const body = await requestJson<{ fields: string[]; data: [number, string, string, string][] }>("SEC EDGAR", "https://www.sec.gov/files/company_tickers_exchange.json", { signal, headers: { "User-Agent": userAgent } });
  return new Map(body.data.map(([cik, name, ticker, exchange]) => [ticker.toUpperCase(), { cik: String(cik), name, exchange }]));
}

export const filingUrl = (cik: string | number, accn: string) => `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accn.replace(/-/g, "")}/`;
export const documentUrl = (cik: string | number, accn: string, doc: string) => `${filingUrl(cik, accn)}${doc}`;

export const PERIODIC_FORMS = new Set(["10-Q", "10-K", "10-Q/A", "10-K/A", "20-F", "20-F/A"]);

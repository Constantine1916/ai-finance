import { describe, expect, it } from "vitest";
import { parseRevenueReport } from "@/sources/tsmc";

// 取自 2026-10-08 报送的 6-K（精简），表格单位为百万新台币
const html = `<p>TSMC September 2026 Revenue Report</p><p>HSINCHU – October 8, 2026 - TSMC today announced its net revenue for September 2026:
On a consolidated basis, revenue for September 2026 was approximately NT$511.86 billion</p>
<table><tr><td>Net Revenue</td><td>511,857</td><td>514,806</td><td>(0.6)</td><td>330,980</td><td>54.6</td><td>3,898,727</td><td>2,762,964</td><td>41.1</td></tr></table>`;

describe("TSMC 6-K revenue report", () => {
  it("parses current, prior month, year-ago and year-to-date values", () => {
    expect(parseRevenueReport(html)).toEqual({ month: "2026-09-01", current: 511857, priorMonth: 514806, yearAgo: 330980, ytd: 3898727, ytdPriorYear: 2762964 });
  });

  it("handles January reports, which have no year-to-date columns and use numeric entities", () => {
    const jan = "<p>announced its net revenue for January 2026&#58; revenue for January 2026 was approximately NT$401.26 billion</p><p>Net Revenue 401,255 335,003 19.8 293,288 36.8 TSMC Spokesperson&#58;</p>";
    expect(parseRevenueReport(jan)).toEqual({ month: "2026-01-01", current: 401255, priorMonth: 335003, yearAgo: 293288, ytd: 401255, ytdPriorYear: 293288 });
  });

  it("returns null for 6-Ks that are not revenue reports", () => {
    expect(parseRevenueReport("<p>Board of Directors meeting resolutions</p>")).toBeNull();
  });
});

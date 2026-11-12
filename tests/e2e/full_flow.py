"""
End-to-end check of the complete Palm Bite Loyalty journey in real Chromium,
including a real camera scan (Chromium's fake camera plays a video of the
live QR code captured from the admin display).

Requirements: a running app (npm run build && npm start) connected to a
Supabase project or local stack, Python Playwright, ffmpeg and psql access to
the same database (used only to promote the test administrator and to fast
forward points with an audited admin adjustment).

Usage:
  E2E_BASE_URL=http://localhost:3000 E2E_DATABASE_URL=postgres://... python3 tests/e2e/full_flow.py
Screenshots are written to E2E_OUT (default ./e2e-output).
"""
import os
import re
import subprocess
import sys
import time
import uuid

from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("E2E_BASE_URL", "http://localhost:3000")
DB = os.environ["E2E_DATABASE_URL"]
OUT = os.environ.get("E2E_OUT", "e2e-output")
os.makedirs(OUT, exist_ok=True)
run_id = uuid.uuid4().hex[:6]
PASSWORD = "PalmBite2026"


def sql(query: str) -> str:
    return subprocess.run(["psql", DB, "-tAc", query], check=True, capture_output=True, text=True).stdout.strip()


def shot(page, name):
    page.screenshot(path=os.path.join(OUT, f"{name}.png"), full_page=True)


def register(page, name, phone, email):
    page.goto(f"{BASE}/join")
    page.get_by_label("Full name").fill(name)
    page.get_by_label("Phone number").fill(phone)
    page.get_by_label("Email").fill(email)
    page.get_by_label("Password").fill(PASSWORD)
    page.get_by_role("button", name="Create my card").click()
    page.wait_for_url(re.compile(r"/(check-email|home)"))


def login(page, email, expect_path):
    # Sign out first in case email confirmation is off and signup already signed in.
    page.context.clear_cookies()
    page.goto(f"{BASE}/login")
    page.get_by_label("Email").fill(email)
    page.get_by_label("Password").fill(PASSWORD)
    page.get_by_role("button", name="Sign in").click()
    page.wait_for_url(re.compile(expect_path))


def check(label, cond):
    print(("PASS " if cond else "FAIL ") + label)
    if not cond:
        sys.exit(1)


with sync_playwright() as p:
    admin_email = f"admin-{run_id}@example.test"
    cust_email = f"guest-{run_id}@example.test"

    # Administrator ----------------------------------------------------------
    desktop = p.chromium.launch()
    admin = desktop.new_page(viewport={"width": 1366, "height": 900})
    register(admin, "Ada Admin", f"0805{abs(hash(run_id)) % 10**7:07d}", admin_email)
    sql(f"select public.promote_to_admin('{admin_email}')")
    login(admin, admin_email, r"/admin")
    shot(admin, "10-admin-overview-empty")

    admin.goto(f"{BASE}/display")
    qr = admin.locator('[aria-label="Palm Bite visit QR code"]')
    qr.wait_for(timeout=15000)
    time.sleep(0.8)
    shot(admin, "11-qr-display")
    qr_png = os.path.join(OUT, "qr.png")
    qr.screenshot(path=qr_png)

    y4m = os.path.join(OUT, "qr.y4m")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-i", qr_png, "-t", "3", "-r", "10",
         "-vf", "scale=600:600,pad=1280:720:(ow-iw)/2:(oh-ih)/2:white,format=yuv420p", y4m],
        check=True,
    )

    # Customer with a fake camera showing the live code -----------------------
    phone_browser = p.chromium.launch(args=[
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        f"--use-file-for-fake-video-capture={os.path.abspath(y4m)}",
    ])
    ctx = phone_browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.grant_permissions(["camera"], origin=BASE)
    phone = ctx.new_page()
    phone.goto(BASE)
    time.sleep(0.4)
    shot(phone, "00-splash")
    time.sleep(1.4)
    shot(phone, "01-welcome")

    register(phone, "Tolu Bello", f"0803{abs(hash(run_id + 'c')) % 10**7:07d}", cust_email)
    shot(phone, "02-after-signup")
    login(phone, cust_email, r"/home")
    expect(phone.get_by_text("00 / 15 VISITS")).to_be_visible()
    check("new customer starts at 00 / 15", True)
    shot(phone, "03-home-zero")

    phone.goto(f"{BASE}/scan")
    shot(phone, "04-scan-intro")
    phone.get_by_role("button", name="Open camera").click()
    expect(phone.get_by_text("Waiting for Palm Staff")).to_be_visible(timeout=20000)
    check("scan waits for Palm Staff approval", True)
    shot(phone, "05a-waiting")
    time.sleep(1)
    check("no point before approval", sql(f"select current_points from public.loyalty_accounts a join public.profiles p on p.id = a.customer_id where p.email = '{cust_email}'") == "0")
    expect(admin.get_by_role("button", name="Approve +1")).to_be_visible(timeout=15000)
    shot(admin, "11b-display-approval")
    admin.get_by_role("button", name="Approve +1").click()
    expect(admin.get_by_text(re.compile(r"\+1 for Tolu Bello"))).to_be_visible(timeout=15000)
    check("staff approves from the counter screen", True)
    expect(admin.get_by_text("Code used. Here's a fresh one.")).to_be_visible(timeout=15000)
    check("counter shows a new code after it is used", True)
    shot(admin, "11c-display-after")
    expect(phone.get_by_text("+1 POINT!")).to_be_visible(timeout=20000)
    check("point lands on the Palm Fren's phone after approval", True)
    shot(phone, "05-scan-success")

    phone.goto(f"{BASE}/home")
    expect(phone.get_by_text("01 / 15 VISITS")).to_be_visible()
    check("dashboard shows 01 / 15 after scan", True)
    shot(phone, "06-home-one")

    phone.goto(f"{BASE}/scan")
    phone.get_by_role("button", name="Open camera").click()
    expect(phone.get_by_text("You've already collected your Palm Bite point for today")).to_be_visible(timeout=20000)
    check("second scan the same day is refused", True)
    shot(phone, "07-scan-already")

    # Fast forward with an audited administrator correction (14 points) ------
    cust_id = sql(f"select id from public.profiles where email = '{cust_email}'")
    admin_id = sql(f"select id from public.profiles where email = '{admin_email}'")
    res = sql(
        "begin; set local role authenticated; "
        f"select set_config('request.jwt.claims', '{{\"sub\":\"{admin_id}\",\"role\":\"authenticated\"}}', true); "
        f"select public.admin_adjust_points('{cust_id}', 14, 'E2E test: simulate fourteen earlier visits'); commit;"
    )
    check("admin adjustment unlocks the reward", '"reward_unlocked": true' in res)

    phone.goto(f"{BASE}/home")
    expect(phone.get_by_text("Your next drink is on us!")).to_be_visible()
    shot(phone, "08-home-unlocked")
    phone.get_by_role("link", name="Choose My Drink").click()
    phone.wait_for_url(re.compile(r"/rewards/"))
    time.sleep(0.6)
    shot(phone, "09-choose-drink")
    phone.get_by_role("button", name="Oat").first.click()
    phone.get_by_role("button", name="Continue").click()
    shot(phone, "09b-confirm-drink")
    phone.get_by_role("button", name="Reserve my drink").click()
    ref_el = phone.locator("text=/PB-[0-9A-Z]{6}/").first
    ref_el.wait_for(timeout=15000)
    reference = re.search(r"PB-[0-9A-Z]{6}", ref_el.inner_text()).group(0)
    check(f"redemption reference issued ({reference})", True)
    shot(phone, "10-reserved")
    phone.goto(f"{BASE}/rewards")
    shot(phone, "11-rewards-pending")

    # Staff redemption -------------------------------------------------------
    admin.goto(f"{BASE}/admin/rewards")
    admin.get_by_label("Redemption code").fill(reference)
    admin.get_by_role("button", name="Find").click()
    expect(admin.get_by_text("Drink to serve")).to_be_visible()
    shot(admin, "12-staff-verify")
    admin.get_by_role("button", name="Confirm drink served").click()
    admin.get_by_role("button", name="Yes, drink served").click()
    expect(admin.get_by_text(re.compile("Their card has been reset to zero"))).to_be_visible(timeout=15000)
    check("staff completes redemption", True)
    shot(admin, "13-staff-served")

    phone.goto(f"{BASE}/home")
    expect(phone.get_by_text("00 / 15 VISITS")).to_be_visible()
    expect(phone.get_by_text("Card 2")).to_be_visible()
    check("card resets to 00 / 15 and card 2 begins", True)
    shot(phone, "14-home-new-cycle")
    phone.goto(f"{BASE}/rewards")
    shot(phone, "15-rewards-history")
    visits = sql(f"select count(*) from public.visits where customer_id = '{cust_id}'")
    check("visit history kept after reset", visits == "1")

    for path, name in [("/admin", "16-admin-overview"), ("/admin/customers", "17-admin-customers"),
                       (f"/admin/customers/{cust_id}", "18-admin-customer"), ("/admin/qr", "19-admin-qr"),
                       ("/admin/drinks", "20-admin-drinks"), ("/admin/reports?kind=points", "21-admin-reports"),
                       ("/admin/settings", "22-admin-settings"), ("/staff", "23-staff")]:
        admin.goto(f"{BASE}{path}")
        shot(admin, name)

    csv = admin.request.get(f"{BASE}/api/reports/balances")
    check("CSV export downloads", csv.status == 200 and "current_points" in csv.text())
    blocked = phone.request.get(f"{BASE}/api/reports/balances")
    check("customers cannot export reports", blocked.status == 403)
    for path in ["/drinks", "/profile"]:
        phone.goto(f"{BASE}{path}")
        shot(phone, path.strip("/"))
    phone.goto(f"{BASE}/admin")
    check("customer is kept out of admin", "/admin" not in phone.url)

    print("All end-to-end checks passed.")
    desktop.close()
    phone_browser.close()

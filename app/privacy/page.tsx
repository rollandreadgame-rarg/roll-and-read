import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { OPERATOR, SUPPORT_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Privacy Policy — Roll & Read",
  description:
    "How Roll & Read collects, uses, shares, keeps and deletes information about grown-ups and children, and the rights parents have under COPPA.",
};

const mail = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

// Written to meet the Children's Online Privacy Protection Rule (16 CFR Part
// 312, as amended in 2025): §312.4(d) online notice contents, §312.10 written
// data retention policy, §312.6 parental review and deletion, §312.8 security.
// Every statement must match what the app actually does; when the app changes,
// update this page (and the "Last updated" date) in the same change.
export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="October 25, 2026">
      <p>
        Roll &amp; Read is a phonics reading game for young children. Grown-ups (parents, guardians
        and teachers) create the account and set up a &ldquo;reader&rdquo; for each child; children
        only play. This policy explains what information we collect, why, who we share it with, how
        long we keep it, and the rights parents and teachers have. It includes our notice of
        children&rsquo;s information practices under the Children&rsquo;s Online Privacy Protection
        Act (COPPA).
      </p>

      <h2>The short version</h2>
      <ul>
        <li>Only adults can create an account. Children never give us an email address, a last name, a photo, their voice or their location.</li>
        <li>For each child we keep a first name or nickname, an avatar, and their game progress, so the game can teach at the right level and grown-ups can see how reading is going.</li>
        <li>No advertising, no selling or renting of information, no tracking across other websites, no chat and no public profiles.</li>
        <li>Parents and teachers can see, change and delete a child&rsquo;s information at any time. Readers nobody has played for two years are deleted automatically.</li>
      </ul>

      <h2>1. Who we are and how to reach us</h2>
      <p>
        Roll &amp; Read is operated by <strong>{OPERATOR.legalName}</strong>, doing business as Roll
        &amp; Read. We are the only operator that collects or keeps children&rsquo;s information
        through Roll &amp; Read, and we answer all questions from parents and schools about it.
      </p>
      <ul>
        <li>Email: {mail}</li>
        {OPERATOR.mailingAddress && <li>Mail: {OPERATOR.mailingAddress}</li>}
        {OPERATOR.phone && <li>Phone: {OPERATOR.phone}</li>}
        <li>Website: <a href="https://rollandreadgame.com">rollandreadgame.com</a></li>
      </ul>

      <h2>2. Who uses Roll &amp; Read</h2>
      <p>
        An account can only be created by an adult, at least 18 years old, who is the parent or legal
        guardian of the children they add, or a teacher using Roll &amp; Read for school with the
        authority to do so. The account holder adds one &ldquo;reader&rdquo; per child. Children play
        through their reader; they cannot create an account, sign in on their own, buy anything, or
        change settings. Grown-up areas (Settings, Billing and the Teacher dashboard) can be locked
        with a grown-up PIN.
      </p>

      <h2>3. Information we collect</h2>
      <h3>From the grown-up who holds the account</h3>
      <ul>
        <li><strong>Sign-in details:</strong> your email address and, if you choose one, a password (stored only by our sign-in provider, Clerk, never by us in readable form). Clerk also records the device and browser used to sign in, to protect your account.</li>
        <li><strong>Grown-up PIN:</strong> if you set one, we store only a scrambled (hashed) version.</li>
        <li><strong>Billing:</strong> if you subscribe, Stripe collects your payment details. We never see or store your card number; we keep a Stripe customer reference, your plan and its status.</li>
        <li><strong>Messages you send us</strong>, such as support emails.</li>
      </ul>
      <h3>About each child, entered by the grown-up</h3>
      <ul>
        <li>A <strong>first name or nickname</strong> (we ask for no last names), an <strong>avatar</strong> picked from a set of emoji, a starting <strong>reading level</strong>, a word setting and a color theme.</li>
      </ul>
      <h3>Created as a child plays</h3>
      <ul>
        <li><strong>Game progress:</strong> which words were read and how many tries each took, words that need more practice, reading level and level-ups, coins, stickers, streaks, and session summaries (date, length, accuracy).</li>
      </ul>
      <h3>Collected automatically when anyone uses Roll &amp; Read</h3>
      <ul>
        <li><strong>Device and connection information:</strong> the device&rsquo;s IP address, browser type and the pages requested, which our hosting and delivery providers receive with every request, and a sign-in cookie that keeps the grown-up&rsquo;s session open.</li>
        <li><strong>Anonymous visit counts and page speed</strong> (Vercel Web Analytics and Speed Insights). These use no cookies and do not identify anyone.</li>
        <li><strong>Crash reports:</strong> if the app breaks while someone is signed in, we record the error, the page it happened on, the browser type and the account it happened in, so we can fix it. Reader names, words and answers are not included.</li>
      </ul>
      <p>
        Under COPPA, an IP address or similar identifier from a child&rsquo;s device counts as
        personal information. We use these identifiers <strong>only to support the internal
        operations of Roll &amp; Read</strong>: to deliver pages, sounds and images, keep the grown-up
        signed in, keep the service secure, count visits anonymously, and find and fix problems. They
        are never used for advertising, to contact a child, to build a profile of a person, or to
        track anyone across other websites. We make sure of this by using no advertising or tracking
        services at all, and by using only providers that process this information for us and for no
        purpose of their own.
      </p>
      <h3>What we never collect from children</h3>
      <p>
        No last names, email addresses, phone numbers, home addresses, photos, video, voice
        recordings, precise location, or any government ID. Roll &amp; Read does not use a microphone
        or camera, has no chat or messaging, and gives children no way to make any information
        public.
      </p>

      <h2>4. How we use information</h2>
      <ul>
        <li>To run the game: say each word aloud, choose words at the right level, bring back missed words for practice, award coins and stickers, and save progress.</li>
        <li>To show grown-ups how each child is reading (Progress page, word bank and Teacher dashboard).</li>
        <li>To run accounts and subscriptions, answer support requests, and send account emails such as sign-in codes and payment receipts. We do not send marketing email to children, ever.</li>
        <li>To keep Roll &amp; Read secure, prevent abuse, and fix problems.</li>
        <li>To meet legal obligations.</li>
      </ul>
      <p>
        We do <strong>not</strong> show advertising (contextual or targeted), sell or rent personal
        information, &ldquo;share&rdquo; it for cross-context behavioral advertising, build profiles
        of children for any purpose other than teaching reading in the game, or use children&rsquo;s
        information to train artificial intelligence.
      </p>

      <h2>5. Parental notice and consent</h2>
      <p>
        Roll &amp; Read is designed so that a grown-up is involved before a child plays. The adult who
        creates the account is shown this policy at sign-up, confirms they are the child&rsquo;s parent,
        guardian or teacher, and then adds each reader themselves. Adding a reader is how a parent
        agrees to the collection and use described here. A parent who does not agree can delete the
        reader (or the whole account) at any time, and we will stop collecting and delete the
        child&rsquo;s information.
      </p>
      <p>
        We do not disclose children&rsquo;s information to third parties other than the service
        providers listed below, who handle it only so Roll &amp; Read can work. If we ever wanted to
        share children&rsquo;s information with anyone else, we would first ask for the
        parent&rsquo;s separate consent, and a parent could say no and still use Roll &amp; Read. If
        we ever change how we collect, use or share children&rsquo;s information in a meaningful way,
        we will notify account holders and ask for consent before the change applies.
      </p>

      <h2>6. Schools and teachers</h2>
      <p>
        When a teacher or school uses Roll &amp; Read for classroom learning, the school may consent
        on behalf of parents, as the Federal Trade Commission allows, but only for the
        school&rsquo;s educational purpose and never for any commercial use. In that case we act as a
        service provider to the school, under the school&rsquo;s direct control of the data, and:
      </p>
      <ul>
        <li>use student information only to provide Roll &amp; Read to the school;</li>
        <li>never sell it, use it for advertising, or build profiles for any non-educational purpose;</li>
        <li>delete it when the school asks, or when the teacher deletes the readers or the account;</li>
        <li>help the school answer a parent&rsquo;s request to review or delete their child&rsquo;s information.</li>
      </ul>
      <p>
        Schools remain responsible for giving parents any notices their own policies or laws (such
        as FERPA and state student-privacy laws) require. Parents of students can contact their
        teacher or us at {mail}.
      </p>

      <h2>7. Who we share information with</h2>
      <p>
        We use these service providers. Each processes information only on our behalf, under written
        terms that require them to keep it confidential and secure:
      </p>
      <ul>
        <li><strong>Clerk</strong> (sign-in): the grown-up&rsquo;s email, password and sign-in device details.</li>
        <li><strong>Convex</strong> (our database): account, reader and game-progress information.</li>
        <li><strong>Vercel</strong> (website hosting): device and connection information needed to deliver the site, short-lived server logs, and anonymous visit counts and page speed.</li>
        <li><strong>Cloudflare</strong> (sticker image delivery): the device&rsquo;s IP address, needed to deliver the images.</li>
        <li><strong>Stripe</strong> (payments, grown-ups only): billing details for subscriptions.</li>
      </ul>
      <p>
        We may also disclose information if the law requires it, to protect the safety of a child or
        anyone else, or to protect Roll &amp; Read from fraud or abuse. If Roll &amp; Read were ever
        sold or merged, this policy would continue to apply to information collected under it, and
        we would notify account holders first.
      </p>

      <h2>8. How long we keep information (our data retention policy)</h2>
      <p>
        We keep children&rsquo;s information only as long as it is reasonably needed to provide the
        game, and never indefinitely:
      </p>
      <ul>
        <li><strong>Reader information and game progress</strong> are kept so a child can pick up where they left off and grown-ups can see progress. They are deleted right away when a grown-up deletes the reader or the account, and automatically when nobody has played that reader for <strong>2 years</strong> (unless the account is on an active paid plan, in which case we keep them until the reader or account is deleted).</li>
        <li><strong>Crash reports</strong> are kept for <strong>90 days</strong> to find and fix problems, then deleted automatically.</li>
        <li><strong>Server logs</strong> (device and connection information) are kept by our hosting providers only for short periods, typically days and never more than 30 days, for security and troubleshooting.</li>
        <li><strong>Grown-up account information</strong> is kept until the account is deleted. When an account is deleted, its readers and their data are deleted at the same time and any subscription is canceled.</li>
        <li><strong>Billing records</strong> are kept by Stripe for as long as tax and accounting laws require. They contain no information about children.</li>
      </ul>
      <p>
        Deleted information may remain in our providers&rsquo; routine backups for a short time
        before it is overwritten; it is not used during that time.
      </p>

      <h2>9. Your rights: review, change, delete, and stop collection</h2>
      <p>A parent, guardian or teacher who holds the account can, at any time:</p>
      <ul>
        <li><strong>Review</strong> what we have about a child on the Progress, Words and Stickers pages and the Teacher dashboard.</li>
        <li><strong>Change</strong> a reader&rsquo;s name, avatar, level and settings in Settings.</li>
        <li><strong>Delete</strong> a reader and all of their data in Settings (the delete button next to the reader).</li>
        <li><strong>Delete the whole account</strong> from the account menu (Manage account, then Delete account). All readers and their data are deleted, and any subscription is canceled.</li>
        <li><strong>Stop further collection</strong> by deleting the reader; nothing more is collected about that child.</li>
      </ul>
      <p>
        You can also email {mail} to ask for a copy of a child&rsquo;s information or for deletion.
        To protect children, we act on requests that come from the account holder&rsquo;s email
        address or that we can otherwise verify come from the child&rsquo;s parent or school, and we
        respond within 30 days. Depending on where you live, you may have further rights to know,
        correct or delete personal information; we honor them for every user, and we will never treat
        you differently for using them.
      </p>

      <h2>10. How we protect information</h2>
      <p>
        We keep a written information security program, which we review at least once a year. It
        includes: encrypted connections (HTTPS) everywhere; data stored with providers that encrypt it
        at rest; checks on every request so an account can only reach its own readers; hashed PINs;
        limiting who can access production systems; choosing providers that commit in writing to
        keep information secure; and automated tests for these protections. No system is perfectly
        secure. If a breach ever affects your information, we will tell you and the authorities as
        the law requires.
      </p>

      <h2>11. Cookies and storage on your device</h2>
      <p>
        Roll &amp; Read uses only the cookies needed to keep the grown-up signed in. It saves a few
        things in the browser itself, such as the color theme, sound settings and a board in
        progress, so they survive a reload. We use no advertising cookies and no third-party tracking.
        Our visit counts use no cookies.
      </p>

      <h2>12. Where information is stored</h2>
      <p>
        Roll &amp; Read is intended for families and schools in the United States. Our database and
        sign-in records are stored in the United States; content delivery and payment providers may
        process requests on servers closer to you.
      </p>

      <h2>13. Changes to this policy</h2>
      <p>
        When we update this policy we change the &ldquo;Last updated&rdquo; date above. For
        meaningful changes we will email account holders before they take effect, and where COPPA
        requires it we will ask for consent again before using children&rsquo;s information in a new
        way.
      </p>

      <h2>14. Contact us</h2>
      <p>
        Questions about this policy or a child&rsquo;s information? Email {mail}. We answer within 30
        days, usually much sooner.
      </p>
    </LegalPage>
  );
}

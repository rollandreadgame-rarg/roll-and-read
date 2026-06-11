import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — Roll & Read",
  description: "The terms that govern your use of Roll & Read.",
};

const SUPPORT_EMAIL = "support@rollandreadgame.com";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="June 11, 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of Roll &amp; Read (the
        &ldquo;Service&rdquo;). By creating an account or using the Service, you agree to these Terms.
        If you do not agree, please do not use the Service.
      </p>

      <h2>1. Who may use Roll &amp; Read</h2>
      <p>
        You must be at least 18 years old to create an account. By creating an account, you confirm
        that you are the <strong>parent or legal guardian</strong> of any child whose profile you
        create, or a <strong>teacher</strong> creating profiles for students in an educational
        capacity with appropriate authority to do so. Children may use the Service only through a
        profile created and supervised by an adult account holder.
      </p>

      <h2>2. Your account</h2>
      <p>
        You are responsible for the activity under your account and for keeping your login credentials
        secure. You agree to provide accurate information and to notify us of any unauthorized use. You
        are responsible for the child profiles you create and the information you enter for them.
      </p>

      <h2>3. Subscriptions and payment</h2>
      <p>
        Roll &amp; Read offers a free tier and paid subscription plans. Paid plans are billed in
        advance on a recurring basis (for example, monthly) through our payment processor, Stripe, and
        renew automatically until cancelled. You can cancel at any time through the billing portal in
        your account; cancellation takes effect at the end of the current billing period. Except where
        required by law, payments are non-refundable. We may change plan features or pricing with
        reasonable notice; changes do not affect the period you have already paid for.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for any unlawful purpose or in violation of these Terms.</li>
        <li>Attempt to access accounts, data, or systems that are not yours.</li>
        <li>Interfere with, disrupt, or attempt to reverse-engineer the Service.</li>
        <li>Resell, sublicense, or commercially exploit the Service without our permission.</li>
      </ul>

      <h2>5. Content and intellectual property</h2>
      <p>
        The Service, including its software, artwork, stickers, sounds, word lists, and design, is
        owned by Roll &amp; Read and protected by intellectual-property laws. We grant you a limited,
        non-exclusive, non-transferable right to use the Service for its intended educational purpose.
        You may not copy, distribute, or create derivative works from the Service except as allowed by
        these Terms or applicable law.
      </p>

      <h2>6. Privacy</h2>
      <p>
        Your use of the Service is also governed by our{" "}
        <a href="/privacy">Privacy Policy</a>, which explains how we handle information for parents,
        teachers, and children.
      </p>

      <h2>7. Disclaimers</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties
        of any kind, whether express or implied. Roll &amp; Read is an educational tool and does not
        guarantee any specific learning outcome. We do not warrant that the Service will be
        uninterrupted, error-free, or completely secure.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Roll &amp; Read will not be liable for any indirect,
        incidental, special, consequential, or punitive damages, or for any loss of data, arising from
        your use of the Service. Our total liability for any claim relating to the Service will not
        exceed the amount you paid us in the twelve months before the claim.
      </p>

      <h2>9. Termination</h2>
      <p>
        You may stop using the Service and delete your account at any time. We may suspend or terminate
        access if you violate these Terms or to protect the Service or other users. Sections that by
        their nature should survive termination (such as intellectual property, disclaimers, and
        limitation of liability) will survive.
      </p>

      <h2>10. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. If we make material changes, we will update the
        &ldquo;Last updated&rdquo; date and, where appropriate, notify you. Continued use of the Service
        after changes take effect means you accept the updated Terms.
      </p>

      <h2>11. Governing law</h2>
      <p>
        These Terms are governed by the laws of the United States and the state in which Roll &amp;
        Read operates, without regard to conflict-of-laws principles.
      </p>

      <h2>12. Contact us</h2>
      <p>
        Questions about these Terms? Email us at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}

import React from 'react';
import { Building2, Mail, MapPin, Calendar, ExternalLink } from 'lucide-react';

export default function BusinessInfoPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="bg-card text-card-foreground rounded-lg shadow-sm border border-border p-8">
        <h1 className="text-3xl font-bold mb-8">
          Business Information & Legal
        </h1>

        {/* Company Information */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-2">
            Company Information
          </h2>

          <div className="bg-accent rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-4">
              AI-powered software products.
            </p>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <dt className="font-medium">Company</dt>
                  <dd className="text-muted-foreground">Seung, LLC</dd>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <dt className="font-medium">Address</dt>
                  <dd className="text-muted-foreground">
                    131 Continental Drive, Suite 305<br />
                    Newark, DE 19713, United States
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <dt className="font-medium">Contact</dt>
                  <dd className="text-muted-foreground">
                    <a href="mailto:support@seung.ai" className="text-blue-600 hover:text-blue-800 underline">
                      support@seung.ai
                    </a>
                  </dd>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Terms of Service */}
        <div className="mt-12 pt-8 border-t border-border">
          <h2 className="text-2xl font-bold mb-6">
            Terms of Service
          </h2>

          <div className="flex items-center gap-2 text-muted-foreground mb-6">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">Effective: June 19, 2025</span>
          </div>

          <div className="prose prose-zinc max-w-none">
            <div className="space-y-6">
              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">1. Acceptance of Terms</h3>
                <p className="text-sm text-muted-foreground">
                  By accessing or using the web-based summarization service (the &quot;Service&quot;) provided by Seung, LLC (&quot;Company&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">2. Definitions</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>&quot;User&quot; means any individual who creates an account and uses the Service.</li>
                  <li>&quot;Content&quot; means any materials provided through or uploaded to the Service.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">3. Changes to Terms</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>These Terms become effective when posted on the Service or otherwise communicated to users.</li>
                  <li>The Company may modify these Terms at any time in compliance with applicable law.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">4. Account Registration</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>A service agreement is formed when you agree to these Terms and our Privacy Policy during registration.</li>
                  <li>The Company may refuse service if false information is provided or applicable laws are violated.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">5. Service Availability</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>The Company aims to provide the Service 24/7, year-round.</li>
                  <li>Users will be notified in advance of any material changes to the Service.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">6. Restrictions on Use</h3>
                <p className="text-sm text-muted-foreground mb-2">The Company may restrict access to the Service if a user:</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Violates applicable laws or public order</li>
                  <li>Interferes with the normal operation of the Service</li>
                  <li>Infringes on the rights of others</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">7. User Obligations</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Users must comply with these Terms and all applicable laws.</li>
                  <li>Users must not use another person&apos;s information without authorization.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">8. Intellectual Property</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Copyright of content within the Service belongs to the original author.</li>
                  <li>The Company is granted a limited license to use user-created content as necessary to operate the Service.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">9. Disclaimer of Liability</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>The Company is not liable for damages caused by force majeure, system failures, or other circumstances beyond its control.</li>
                  <li>The Company is not responsible for service disruptions caused by the user&apos;s own actions.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">10. Governing Law & Jurisdiction</h3>
                <p className="text-sm text-muted-foreground">These Terms are governed by the laws of the State of Delaware, United States. Any disputes shall be resolved in the courts located in the State of Delaware.</p>
              </section>
            </div>
          </div>
        </div>

        {/* Privacy Policy */}
        <div className="mt-12 pt-8 border-t border-border">
          <h2 className="text-2xl font-bold mb-6">
            Privacy Policy
          </h2>

          <div className="flex items-center gap-2 text-muted-foreground mb-6">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">Effective: June 19, 2025</span>
          </div>

          <div className="prose prose-zinc max-w-none">
            <p className="text-muted-foreground mb-6">
              <strong>Seung, LLC</strong> (&quot;Company&quot;) values your privacy and complies with applicable data protection laws. This Privacy Policy explains how your personal information is collected, used, stored, and protected when you use our web-based summarization service (the &quot;Service&quot;).
            </p>

            <div className="space-y-6">
              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">
                  1. Information We Collect
                </h3>
                <p className="mb-3 text-sm text-muted-foreground">We may collect the following personal information:</p>

                <div className="space-y-3 text-sm">
                  <div>
                    <h4 className="font-medium">During Registration & Login</h4>
                    <ul className="list-disc list-inside text-muted-foreground ml-4">
                      <li>Email address (via OAuth or email login)</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium">Automatically Collected During Use</h4>
                    <ul className="list-disc list-inside text-muted-foreground ml-4">
                      <li>IP address, browser information, access timestamps, usage logs</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium">During Payment (collected by third-party processors; not stored by the Company)</h4>
                    <ul className="list-disc list-inside text-muted-foreground ml-4">
                      <li>Transaction ID, payment amount, payment status</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">
                  2. Purpose of Collection
                </h3>
                <p className="mb-3 text-sm text-muted-foreground">We use collected information for the following purposes:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
                  <li>Service delivery, user authentication, and session management</li>
                  <li>Payment processing and refunds for paid services</li>
                  <li>Customer support and technical assistance</li>
                  <li>Statistical analysis and user feedback for service improvement</li>
                  <li>Compliance with legal obligations</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">
                  3. Data Retention
                </h3>
                <p className="mb-3 text-sm text-muted-foreground">Upon account deletion, the Company will promptly destroy your personal information.</p>
                <p className="mb-3 text-sm text-muted-foreground">However, certain records may be retained as required by applicable law:</p>

                <div className="bg-accent p-3 rounded-lg text-sm">
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Records of contracts or withdrawal of offers: 5 years</li>
                    <li>Records of payment and supply of goods: 5 years</li>
                    <li>Records of consumer complaints or dispute resolution: 3 years</li>
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">4. Third-Party Disclosure</h3>
                <p className="text-sm text-muted-foreground mb-2">We do not share user information externally except for payment processing and legal compliance:</p>
                <div className="bg-accent p-3 rounded-lg text-sm">
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Recipients: Lemon Squeezy and other payment processors</li>
                    <li>Data shared: Payment identifiers, amounts, and status</li>
                    <li>Purpose: Payment processing and refunds</li>
                    <li>Retention: As required by applicable law</li>
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">5. Service Providers</h3>
                <p className="text-sm text-muted-foreground mb-2">We may delegate certain operations to external service providers:</p>
                <div className="bg-accent p-3 rounded-lg text-sm">
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Payment processing: Lemon Squeezy</li>
                    <li>Email services: Google LLC</li>
                    <li>Hosting: Vercel Inc., Supabase Inc.</li>
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">6. Your Rights</h3>
                <p className="text-sm text-muted-foreground">You may request access to, correction of, deletion of, or restriction of processing of your personal information. Please submit requests to <a href="mailto:support@seung.ai" className="underline text-blue-600 hover:text-blue-800">support@seung.ai</a>, and we will respond promptly.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">7. Cookies</h3>
                <p className="text-sm text-muted-foreground">We may use cookies to provide a personalized experience. You can disable cookies through your browser settings.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">8. Data Protection Contact</h3>
                <div className="bg-accent p-3 rounded-lg text-sm">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-muted-foreground">Email: <a href="mailto:support@seung.ai" className="text-blue-600 hover:text-blue-800 underline">support@seung.ai</a></p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Refund Policy */}
        <div className="mt-12 pt-8 border-t border-border">
          <h2 className="text-2xl font-bold mb-6">
            Refund Policy
          </h2>

          <div className="flex items-center gap-2 text-muted-foreground mb-6">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">Effective: June 19, 2025</span>
          </div>

          <div className="prose prose-zinc max-w-none">
            <p className="text-muted-foreground mb-6">
              The following outlines the refund policy for paid services provided by <strong>Seung, LLC</strong>.
            </p>

            <div className="space-y-6">
              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">
                  1. Eligibility for Refund
                </h3>
                <p className="mb-3 text-sm text-muted-foreground">A full refund is available if all of the following conditions are met:</p>

                <div className="bg-accent p-3 rounded-lg text-sm">
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Within <strong>7 days</strong> of the payment date</li>
                    <li>The summarization feature has <strong>not been used</strong> during that period</li>
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">
                  2. Non-Refundable Cases
                </h3>
                <p className="mb-3 text-sm text-muted-foreground">Refunds may not be available in the following cases:</p>

                <div className="bg-accent p-3 rounded-lg text-sm">
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>The summarization feature has been used one or more times</li>
                    <li>Change of mind or accidental purchase</li>
                    <li>Payment was made after a free trial period</li>
                    <li>Refund is not possible due to third-party payment service policies</li>
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">
                  3. How to Request a Refund
                </h3>
                <p className="mb-3 text-sm text-muted-foreground">To request a refund, please email <a href="mailto:support@seung.ai" className="text-blue-600 hover:text-blue-800 underline">support@seung.ai</a> with the following information:</p>

                <div className="bg-accent p-3 rounded-lg text-sm">
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Name and email address</li>
                    <li>Date of payment and receipt (if available)</li>
                    <li>Reason for refund</li>
                  </ul>
                </div>

                <p className="mt-3 text-muted-foreground text-sm">
                  We will respond within <strong>3 business days</strong> of receiving your request.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3 border-b border-border pb-2">
                  4. Canceling a Subscription
                </h3>

                <div className="bg-accent p-3 rounded-lg text-sm">
                  <p className="text-muted-foreground mb-2">
                    You may cancel your subscription at any time through the following link:
                  </p>

                  <div className="flex items-center gap-2 mb-2">
                    <ExternalLink className="w-4 h-4 text-blue-600" />
                    <a
                      href="https://seung.lemonsqueezy.com/billing"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline font-medium"
                    >
                      https://seung.lemonsqueezy.com/billing
                    </a>
                  </div>

                  <p className="text-muted-foreground">
                    After cancellation, you will retain access to premium features until the end of your current billing period.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

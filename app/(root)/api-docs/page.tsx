import { Metadata } from 'next';

import T from '@/components/i18n/T';
export const metadata: Metadata = {
  title: 'API Documentation - OpenStock',
  description: 'Free and open API documentation for OpenStock platform - no paywalls, no barriers',
};

export default function ApiDocsPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-200 mb-4"><T k="pages.apiDocs.title" /></h1>
        <p className="text-xl text-gray-200 mb-4"><T k="pages.apiDocs.subtitle" /></p>
        <div className="bg-blue-300 border border-blue-400 rounded-lg p-4">
          <p className="text-black text-sm">
            <strong><T k="pages.apiDocs.promiseTitle" />:</strong> <T k="pages.apiDocs.promiseBody" />
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Philosophy */}
        <section className="bg-gray-800 rounded-lg shadow-sm p-6 border">
          <h2 className="text-2xl font-semibold text-gray-100 mb-4"><T k="pages.apiDocs.philosophyTitle" /></h2>
          <p className="text-gray-200 mb-4">
            <T k="pages.apiDocs.philosophyBody" />
          </p>
          <ul className="text-gray-200 space-y-2">
            <li><T k="pages.apiDocs.philosophy.alwaysFree" /></li>
            <li><T k="pages.apiDocs.philosophy.noGatekeeping" /></li>
            <li><T k="pages.apiDocs.philosophy.communityFirst" /></li>
            <li><T k="pages.apiDocs.philosophy.openSource" /></li>
          </ul>
        </section>

        {/* Community Support */}
        <section className="bg-gray-800 rounded-lg shadow-sm p-6 border">
          <h2 className="text-2xl font-semibold text-gray-100 mb-4"><T k="pages.apiDocs.communityTitle" /></h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-green-200 p-4 rounded-lg">
              <h3 className="font-semibold text-black mb-2"><T k="pages.apiDocs.studentsTitle" /></h3>
              <p className="text-gray-800 text-sm">
                <T k="pages.apiDocs.studentsBody" />
              </p>
            </div>
            <div className="bg-blue-300 p-4 rounded-lg">
              <h3 className="font-semibold text-black mb-2"><T k="pages.apiDocs.developersTitle" /></h3>
              <p className="text-gray-800 text-sm">
                <T k="pages.apiDocs.developersBody" />
              </p>
            </div>
          </div>
        </section>

        {/* Open Source Commitment */}
        <section className="bg-gray-800 rounded-lg p-6 border">
          <h2 className="text-2xl font-semibold text-gray-200 mb-4"><T k="pages.apiDocs.openSourceTitle" /></h2>
          <p className="text-gray-200 mb-4">
            <T k="pages.apiDocs.openSourceBody" />
          </p>
          <div className="flex space-x-4">
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://github.com/Open-Dev-Society/"
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
            >
              <T k="pages.apiDocs.contactUs" />
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}








import { Metadata } from 'next';
import T from '@/components/i18n/T';
// Removed unused lucide-react imports

export const metadata: Metadata = {
  title: 'Help Center - OpenStock',
  description: 'Free help and community support - no barriers, just guidance',
};

export default function HelpPage() {
  const faqs = [
    { question: 'pages.help.faq1.q', answer: 'pages.help.faq1.a' },
    { question: 'pages.help.faq2.q', answer: 'pages.help.faq2.a' },
    { question: 'pages.help.faq3.q', answer: 'pages.help.faq3.a' },
    { question: 'pages.help.faq4.q', answer: 'pages.help.faq4.a' },
    { question: 'pages.help.faq5.q', answer: 'pages.help.faq5.a' },
  ];

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-100 mb-4"><T k="pages.help.title" /></h1>
        <p className="text-xl text-gray-200 mb-4"><T k="pages.help.subtitle" /></p>
        <div className="bg-green-300 border border-green-200 rounded-lg p-4 max-w-2xl mx-auto">
          <p className="text-black text-sm">
            <strong><T k="pages.help.promiseTitle" />:</strong> <T k="pages.help.promiseBody" />
          </p>
        </div>
      </div>


      {/* Help Philosophy */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <div className="bg-gray-800 rounded-lg shadow-sm p-6 border hover:shadow-md transition-shadow">

          <h3 className="text-lg font-semibold text-blue-500 mb-2"><T k="pages.help.card.learnTitle" /></h3>
          <p className="text-gray-200 text-sm">
            <T k="pages.help.card.learnBody" />
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-sm p-6 border hover:shadow-md transition-shadow">

          <h3 className="text-lg font-semibold text-green-500 mb-2"><T k="pages.help.card.supportTitle" /></h3>
          <p className="text-gray-200 text-sm">
            <T k="pages.help.card.supportBody" />
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-sm p-6 border hover:shadow-md transition-shadow">

          <h3 className="text-lg font-semibold text-purple-500 mb-2"><T k="pages.help.card.careTitle" /></h3>
          <p className="text-gray-200 text-sm">
            <T k="pages.help.card.careBody" />
          </p>
        </div>
      </div>

      {/* Community FAQs */}
      <section className="mb-12">
        <h2 className="text-3xl font-bold text-gray-100 mb-8 text-center"><T k="pages.help.communityTitle" /></h2>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-gray-800 rounded-lg shadow-sm p-6 border">
              <h3 className="text-lg font-semibold text-gray-100 mb-2"><T k={faq.question} /></h3>
              <p className="text-gray-200"><T k={faq.answer} /></p>
            </div>
          ))}
        </div>
      </section>

      {/* Community Connection */}
      <section className="bg-gradient-to-r from-blue-200 to-purple-200 rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4"><T k="pages.help.joinTitle" /></h2>
        <p className="text-gray-700 mb-6">
          <T k="pages.help.joinBody" />
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
                href="https://discord.gg/jdJuEMvk"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-550 transition-colors text-center inline-block"
            >
                <T k="pages.help.joinDiscord" />
            </a>

            <a
                href="mailto:opendevsociety@gmail.com"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-800 text-gray-200 px-6 py-3 rounded-lg hover:bg-gray-900 transition-colors text-center inline-block"
            >
                <T k="pages.help.emailHelpTeam" />
            </a>
        </div>
        <p className="text-xs text-gray-600 mt-4">
          <T k="pages.help.supportFreeNote" />
        </p>
      </section>
    </div>
  );
}





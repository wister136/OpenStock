import { Metadata } from 'next';

import T from '@/components/i18n/T';
export const metadata: Metadata = {
  title: 'Terms of Service - OpenStock',
  description: 'Fair terms of service - built on trust, transparency, and community values',
};

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-100 mb-4"><T k="pages.terms.title" /></h1>
        <p className="text-gray-300 mb-4">
          <T k="pages.terms.lastUpdated" vars={{ date: 'October 4, 2025' }} />
        </p>
        <div className="bg-green-900 border border-green-700 rounded-lg p-4">
          <p className="text-green-200 text-sm">
            <strong><T k="pages.terms.plainTitle" />:</strong> <T k="pages.terms.plainBody" />
          </p>
        </div>
      </div>

      <div className="prose prose-lg max-w-none">
        <section className="mb-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-100 mb-4"><T k="pages.terms.approachTitle" /></h2>
          <p className="text-gray-200 mb-4"><T k="pages.terms.approachBody" /></p>
          <ul className="text-gray-200 space-y-2">
            <li><T k="pages.terms.approach.item1" /></li>
            <li><T k="pages.terms.approach.item2" /></li>
            <li><T k="pages.terms.approach.item3" /></li>
            <li><T k="pages.terms.approach.item4" /></li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-100 mb-4"><T k="pages.terms.basicsTitle" /></h2>
          <p className="text-gray-200 mb-4"><T k="pages.terms.basicsBody" /></p>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <ul className="text-gray-200 space-y-3">
              <li><T k="pages.terms.basics.item1" /></li>
              <li><T k="pages.terms.basics.item2" /></li>
              <li><T k="pages.terms.basics.item3" /></li>
              <li><T k="pages.terms.basics.item4" /></li>
            </ul>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-100 mb-4"><T k="pages.terms.freeTitle" /></h2>
          <div className="bg-green-900 border border-green-700 rounded-lg p-6">
            <p className="text-green-200 font-medium mb-3"><T k="pages.terms.freeIntro" /></p>
            <ul className="text-gray-200 space-y-2">
              <li><T k="pages.terms.free.item1" /></li>
              <li><T k="pages.terms.free.item2" /></li>
              <li><T k="pages.terms.free.item3" /></li>
              <li><T k="pages.terms.free.item4" /></li>
              <li><T k="pages.terms.free.item5" /></li>
            </ul>
            <p className="text-gray-300 text-sm mt-4 italic"><T k="pages.terms.free.note" /></p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-100 mb-4"><T k="pages.terms.disclaimerTitle" /></h2>
          <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-6">
            <p className="text-yellow-200 font-medium mb-2"><T k="pages.terms.disclaimerIntro" /></p>
            <div className="text-gray-200 space-y-3">
              <p><T k="pages.terms.disclaimer.body1" /></p>
              <p><T k="pages.terms.disclaimer.body2" /></p>
              <p><T k="pages.terms.disclaimer.body3" /></p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-100 mb-4"><T k="pages.terms.accountTitle" /></h2>
          <p className="text-gray-200 mb-4"><T k="pages.terms.accountBody" /></p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-blue-900 border border-blue-700 rounded-lg p-4">
              <h3 className="font-semibold text-blue-200 mb-2"><T k="pages.terms.account.loveTitle" /></h3>
              <ul className="text-blue-200 text-sm space-y-1">
                <li><T k="pages.terms.account.love.item1" /></li>
                <li><T k="pages.terms.account.love.item2" /></li>
                <li><T k="pages.terms.account.love.item3" /></li>
                <li><T k="pages.terms.account.love.item4" /></li>
              </ul>
            </div>
            <div className="bg-red-900 border border-red-700 rounded-lg p-4">
              <h3 className="font-semibold text-red-200 mb-2"><T k="pages.terms.account.hurtTitle" /></h3>
              <ul className="text-red-200 text-sm space-y-1">
                <li><T k="pages.terms.account.hurt.item1" /></li>
                <li><T k="pages.terms.account.hurt.item2" /></li>
                <li><T k="pages.terms.account.hurt.item3" /></li>
                <li><T k="pages.terms.account.hurt.item4" /></li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-100 mb-4"><T k="pages.terms.dataTitle" /></h2>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <p className="text-gray-200 mb-4"><T k="pages.terms.data.body1" /></p>
            <p className="text-gray-200 mb-4"><T k="pages.terms.data.body2" /></p>
            <p className="text-gray-200"><T k="pages.terms.data.body3" /></p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-100 mb-4"><T k="pages.terms.availabilityTitle" /></h2>
          <p className="text-gray-200 mb-4"><T k="pages.terms.availabilityBody" /></p>
          <ul className="text-gray-200 space-y-2 ml-6">
            <li><T k="pages.terms.availability.item1" /></li>
            <li><T k="pages.terms.availability.item2" /></li>
            <li><T k="pages.terms.availability.item3" /></li>
            <li><T k="pages.terms.availability.item4" /></li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-100 mb-4"><T k="pages.terms.changesTitle" /></h2>
          <div className="bg-purple-900 border border-purple-700 rounded-lg p-6">
            <p className="text-purple-200 mb-3"><T k="pages.terms.changesBody" /></p>
            <ul className="text-gray-200 space-y-2">
              <li><T k="pages.terms.changes.item1" /></li>
              <li><T k="pages.terms.changes.item2" /></li>
              <li><T k="pages.terms.changes.item3" /></li>
            </ul>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-100 mb-4"><T k="pages.terms.questionsTitle" /></h2>
          <p className="text-gray-200 mb-4"><T k="pages.terms.questionsBody" /></p>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <p className="text-gray-200 mb-2">
              <strong><T k="pages.terms.questions.legalLabel" />:</strong>{' '}
              <a href="mailto:legal@opendevsociety.org" className="text-blue-400 hover:text-blue-300">
                opendevsociety@cc.cc
              </a>
            </p>
            <p className="text-gray-200">
              <strong><T k="pages.terms.questions.generalLabel" />:</strong>{' '}
              <T k="pages.terms.questions.generalBody" />
            </p>
          </div>
        </section>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
          <h3 className="text-xl font-semibold text-gray-100 mb-3"><T k="pages.terms.closingTitle" /></h3>
          <p className="text-gray-200 mb-2"><T k="pages.terms.closingQuote" /></p>
          <p className="text-gray-300 text-sm"><T k="pages.terms.closingThanks" /></p>
        </div>
      </div>
    </div>
  );
}

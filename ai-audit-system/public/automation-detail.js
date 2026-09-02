const AUTOMATIONS = {
  'phone-agent': { number: '01', title: 'AI Phone Agent', summary: 'A custom phone agent designed around the way your service business handles new enquiries, bookings and urgent jobs.', price: 'From A$2,500 setup', benefits: ['Fewer valuable calls go unanswered', 'Consistent intake questions', 'Clear handover to the right person'], scope: ['Conversation design and call-flow setup', 'Business-specific qualification questions', 'Booking, transfer or callback routing', 'Managed hosting from A$349 per month'] },
  'missed-call-recovery': { number: '02', title: 'Missed-Call Recovery', summary: 'A fast, consistent response when your team misses a call, designed to capture the opportunity before it goes elsewhere.', price: 'From A$1,500', benefits: ['Faster response after missed calls', 'Useful customer details captured', 'Clear follow-up for your team'], scope: ['Missed-call trigger and timing', 'SMS conversation and intake questions', 'Team notification and handover', 'Reporting and exception handling'] },
  'quote-follow-up': { number: '03', title: 'Quote Follow-Up', summary: 'A considered follow-up system that keeps open quotes moving without relying on someone remembering every next step.', price: 'From A$1,500', benefits: ['Consistent follow-up timing', 'Fewer warm quotes forgotten', 'Clear replies returned to staff'], scope: ['Quote-status trigger and schedule', 'Business-specific message sequence', 'Reply capture and staff alerts', 'Stop rules and human handover'] },
  'review-requests': { number: '04', title: 'Review Requests', summary: 'A timely review-request workflow that makes it easy for happy customers to share their experience.', price: 'From A$1,500', benefits: ['Requests sent at the right moment', 'Less manual chasing by staff', 'Clear path for customer feedback'], scope: ['Completion trigger and eligibility rules', 'Branded request messages', 'Review link and reminder sequence', 'Feedback routing and reporting'] },
  'quoting-agent': { number: '05', title: 'Quoting Agent', summary: 'A guided intake system that collects job details and prepares a structured quote draft for staff approval.', price: 'Custom scope', benefits: ['Better information before quoting', 'Less repetitive administration', 'Human approval stays in control'], scope: ['Job-detail intake and validation', 'Pricing rules and exclusions', 'Draft generation for staff review', 'Approval, delivery and audit trail'] }
};

const slug = location.pathname.split('/').filter(Boolean).pop();
const item = AUTOMATIONS[slug] || AUTOMATIONS['phone-agent'];
document.title = `${item.title} | Volve Solutions`;
document.getElementById('detailNumber').textContent = item.number;
document.getElementById('detailTitle').textContent = item.title;
document.getElementById('detailSummary').textContent = item.summary;
document.getElementById('detailPrice').textContent = item.price;
document.getElementById('detailBenefits').replaceChildren(...item.benefits.map((benefit, index) => {
  const article = document.createElement('article');
  const number = document.createElement('span'); number.textContent = `0${index + 1}`;
  const text = document.createElement('p'); text.textContent = benefit;
  article.append(number, text); return article;
}));
document.getElementById('detailScope').replaceChildren(...item.scope.map(text => {
  const li = document.createElement('li'); li.textContent = text; return li;
}));

document.getElementById('enquiryForm').addEventListener('submit', event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  const subject = encodeURIComponent(`${item.title} enquiry from ${values.business || values.name}`);
  const body = encodeURIComponent(`Name: ${values.name}\nBusiness: ${values.business}\nPhone: ${values.phone}\nEmail: ${values.email}\n\nWhat they would like to improve:\n${values.message}`);
  location.href = `mailto:volvesolutions@outlook.com?subject=${subject}&body=${body}`;
});

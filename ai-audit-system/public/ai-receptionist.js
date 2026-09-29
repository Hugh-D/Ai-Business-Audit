(function () {
  var params = new URLSearchParams(window.location.search);
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (key) {
    var field = document.querySelector('[name="' + key + '"]');
    if (field) field.value = params.get(key) || '';
  });
  var referrer = document.querySelector('[name="referrer"]');
  if (referrer) referrer.value = document.referrer || '';

  var calls = document.querySelector('#calcCalls');
  var rate = document.querySelector('#calcRate');
  var jobValue = document.querySelector('#calcValue');
  var result = document.querySelector('#calcResult');

  function renderCalc() {
    var weeklyJobs = (Number(calls.value) || 0) * ((Number(rate.value) || 0) / 100);
    var monthly = weeklyJobs * (Number(jobValue.value) || 0) * 4;
    var rounded = Math.round(monthly);
    result.textContent = 'A$' + rounded.toLocaleString('en-AU');
  }

  if (calls && rate && jobValue && result) {
    [calls, rate, jobValue].forEach(function (input) {
      input.addEventListener('input', renderCalc);
    });
    renderCalc();
  }

  var form = document.querySelector('#trialForm');
  var errorBox = document.querySelector('#trialError');
  var success = document.querySelector('#trialSuccess');
  if (!form) return;

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    errorBox.hidden = true;
    errorBox.textContent = '';

    var data = new FormData(form);
    if (String(data.get('company_website') || '').trim()) {
      form.hidden = true;
      success.hidden = false;
      return;
    }

    var mobile = String(data.get('mobile') || '').replace(/[\s()-]/g, '');
    if (!/^(\+?61|0)4\d{8}$/.test(mobile)) {
      errorBox.textContent = 'Enter an Australian mobile, starting with 04 or +614.';
      errorBox.hidden = false;
      return;
    }

    var lines = [
      'Volve Righto free trial enquiry',
      '',
      'First name: ' + data.get('firstName'),
      'Business name: ' + data.get('business'),
      'Trade or industry: ' + data.get('trade'),
      'Mobile: ' + mobile,
      'Email: ' + data.get('email'),
      'Suburb or service area: ' + (data.get('suburb') || ''),
      'When should it answer: ' + (data.get('when') || ''),
      'Missed calls a week: ' + (data.get('missed') || ''),
      'Job software: ' + (data.get('software') || ''),
      'Consent: yes',
      '',
      'utm_source: ' + (data.get('utm_source') || ''),
      'utm_medium: ' + (data.get('utm_medium') || ''),
      'utm_campaign: ' + (data.get('utm_campaign') || ''),
      'utm_content: ' + (data.get('utm_content') || ''),
      'referrer: ' + (data.get('referrer') || ''),
      'landing_variant: A',
    ];
    var subject = encodeURIComponent('Volve Righto trial enquiry from ' + data.get('business'));
    var body = encodeURIComponent(lines.join('\n'));
    success.hidden = false;
    window.location.href = 'mailto:volvesolutions@outlook.com?subject=' + subject + '&body=' + body;
  });
})();

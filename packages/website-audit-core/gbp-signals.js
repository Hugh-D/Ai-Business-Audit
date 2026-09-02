'use strict';

const GBP_SIGNALS = [
  {
        id: 'gbpCategoryAccurate',
        category: 'gbpFoundational',
        label: 'Accurate Primary Category',
        found: (profile) => Boolean(profile.categoryAccurate),
        foundDetail: 'The primary Google Business Profile category is specific and matches the core business.',
        missingDetail: 'The primary category is missing, too broad, or does not match the core business.',
  },
  {
        id: 'gbpNapConsistent',
        category: 'gbpFoundational',
        label: 'Consistent Name, Address, Phone',
        found: (profile) => Boolean(profile.napMatchesWebsite),
        foundDetail: 'The business name, address, and phone number match the website exactly.',
        missingDetail: 'The name, address, or phone number on the profile does not match the website.',
  },
  {
        id: 'gbpDescriptionComplete',
        category: 'gbpFoundational',
        label: 'Complete Business Description',
        found: (profile) => Boolean(profile.descriptionComplete),
        foundDetail: 'The profile has a complete written description of the business and its services.',
        missingDetail: 'The business description is missing or too thin.',
  },
  {
        id: 'gbpPhotosSufficient',
        category: 'gbpFoundational',
        label: 'Sufficient Photos',
        found: (profile) => Number(profile.photoCount) >= 10,
        foundDetail: 'The profile has at least 10 photos.',
        missingDetail: 'The profile has fewer than 10 photos.',
  },
  {
        id: 'gbpReviewCountHealthy',
        category: 'gbpProminence',
        label: 'Healthy Review Count',
        found: (profile) => Number(profile.reviewCount) >= 25,
        foundDetail: 'The profile has 25 or more reviews.',
        missingDetail: 'The profile has fewer than 25 reviews.',
  },
  {
        id: 'gbpReviewRatingHealthy',
        category: 'gbpProminence',
        label: 'Strong Average Rating',
        found: (profile) => Number(profile.averageRating) >= 4.5,
        foundDetail: 'The average rating is 4.5 stars or higher.',
        missingDetail: 'The average rating is below 4.5 stars.',
  },
  {
        id: 'gbpOwnerRespondsToReviews',
        category: 'gbpProminence',
        label: 'Owner Responds To Reviews',
        found: (profile) => Boolean(profile.ownerRespondsToReviews),
        foundDetail: 'The owner replies to reviews.',
        missingDetail: 'The owner does not appear to reply to reviews.',
  },
  {
        id: 'gbpAppearsInLocalPack',
        category: 'gbpLocalPack',
        label: 'Appears In Local Pack',
        found: (profile) => Boolean(profile.appearsInLocalPack),
        foundDetail: 'The business appears in the local 3-pack for its core service and location searches.',
        missingDetail: 'The business does not appear in the local 3-pack for its core service and location searches.',
  },
    {
        id: 'gbpCitationConsistency',
          category: 'gbpLocalPack',
          label: 'Consistent Citations',
          found: (profile) => Boolean(profile.citationsConsistent),
          foundDetail: 'Name, address, and phone details are consistent across major directories.',
          missingDetail: 'Name, address, or phone details are inconsistent across major directories.',
    },
  ];

const GBP_CATEGORY_LABELS = {
    gbpFoundational: 'GBP Foundational Completeness',
    gbpProminence: 'GBP Prominence Signals',
    gbpLocalPack: 'Local Pack Visibility',
};

const GBP_ACTIONS = {
    gbpCategoryAccurate: 'Set the primary category to the single most specific option that matches the core business, then add secondary categories only where genuinely relevant.',
    gbpNapConsistent: 'Update the profile or website so the business name, address, and phone number match exactly, including formatting.',
        gbpDescriptionComplete: 'Write a complete profile description that covers core services and the service area in plain language.',
    gbpPhotosSufficient: 'Add photos of the team, vehicles, completed work, and premises until the profile has at least 10.',
    gbpReviewCountHealthy: 'Build a simple process to ask every satisfied customer for a review until the count passes 25.',
    gbpReviewRatingHealthy: 'Address the causes behind lower ratings directly and keep asking happy customers for reviews.',
    gbpOwnerRespondsToReviews: 'Reply to every new review, positive or negative, within a few days.',
    gbpAppearsInLocalPack: 'Strengthen relevance and prominence signals (category, description, reviews, links), then re-test the target searches in a few weeks.',
    gbpCitationConsistency: 'Audit listings on the main directories and correct any mismatched name, address, or phone details.',
};

function evaluateGbpSignals(gbpProfile) {
    const profile = gbpProfile || {};
    return GBP_SIGNALS.map((signal) => {
          const found = Boolean(signal.found(profile));
          return {
                  id: signal.id,
                  category: signal.category,
                  categoryLabel: GBP_CATEGORY_LABELS[signal.category],
                  label: signal.label,
                  status: found ? 'found' : 'missing',
                  detail: found ? signal.foundDetail : signal.missingDetail,
          };
    });
}

module.exports = {
              GBP_SIGNALS,
    GBP_CATEGORY_LABELS,
    GBP_ACTIONS,
    evaluateGbpSignals,
};

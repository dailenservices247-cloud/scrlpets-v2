-- D5 education drafts. Inserted UNPUBLISHED (published_at null) — they are
-- invisible to the public until Dailen approves them in /admin (owner action A7).
insert into public.guides (slug, title, summary, body, audience, published_at) values
(
 'first-week-with-a-new-animal',
 'Your first week with a new animal',
 'What to set up before they arrive, and what "normal" looks like in the first seven days.',
 $g$Bring them home on a day you can stay in. The first hours set the tone, and an animal that arrives to an empty house learns that the house is not safe.

Set up one small space before they arrive — a crate, a pen, a single room. A whole house is too much choice for an animal that does not yet know where anything is. Food, water, a bed, and a place to hide. That is enough.

Keep the food they were already eating for the first week, even if you plan to switch. A new home, new water and new food at once is the most common cause of a first-week stomach upset. Change the food gradually after they have settled, mixing a little more of the new food in each day.

Expect quiet, and expect it to break. Many animals are subdued for two or three days and then start showing who they actually are around day four or five. Behaviour in week one is not a preview of the animal you will have in month three.

Book a vet visit in the first week even if nothing is wrong. It establishes a baseline, gets you into a practice before you need one urgently, and catches anything the seller did not know about. Bring whatever records came with the animal.

Write down what you see: eating, drinking, toileting, sleeping, energy. If something goes wrong later, the vet's first question is what changed, and a week of plain notes answers it better than memory.

When to call a vet rather than wait: not eating for more than 24 hours, repeated vomiting or diarrhoea, laboured breathing, a limp that does not improve, or any sudden change in behaviour. Waiting is cheaper than a visit right up until it is not.$g$,
 'owner',
 null
),
(
 'buying-an-animal-safely',
 'Buying an animal safely',
 'The questions to ask, the things to see with your own eyes, and the signals that mean walk away.',
 $g$See the animal before money changes hands. In person if you can, on a live video call if you genuinely cannot. Photos prove nothing about an animal that exists today — they can be old, borrowed, or of a different animal entirely.

Ask to see where the animal lives, not just the animal. A seller who will show you the space, the parents, and the other animals is telling you something a description cannot.

Ask for the animal's history in specifics: date of birth, what vaccinations and when, what worming and when, what the vet has seen and when. "Fully vetted" and "health guaranteed" are phrases, not records. On Scrlpets, records shown on an animal's page are what the owner has entered — we label them that way because we have not checked them ourselves.

Ask why they are selling this animal. There is no wrong answer, but there is a wrong reaction. Vagueness or irritation at a normal question is information.

Get it in writing. What is included, what happens if a vet finds a problem in the first week, and what the seller's return policy actually is. A verbal promise about a sick animal is worth what you can prove.

Walk away from: pressure to decide today, a deposit before you have seen the animal, a seller who will not video call, a price far below everything comparable, a request to pay by a method with no recourse, or a story that changes between messages.

Take the animal to your own vet within a few days of bringing them home, regardless of what the seller told you. That visit is the cheapest insurance in the whole process.$g$,
 'buyer',
 null
),
(
 'what-to-publish-when-you-list',
 'What to publish when you list an animal',
 'What serious buyers look for, and why over-claiming costs you the sale.',
 $g$Lead with what the animal actually is. Species, age or date of birth, size now and expected, temperament as you have observed it. Buyers scrolling past a hundred listings are looking for a reason to stop, and specifics stop people where adjectives do not.

Photograph the animal as they are today, in daylight, from more than one angle, without filters. Include one photo that shows their whole body and one that shows where they live. A short video does more than another five photos.

Put the health record in the record fields, not in the description. It shows up on the animal's page labelled as your declaration, which is exactly what it is. Buyers who compare listings will notice which sellers filled it in.

Say what you do not know. "Vaccinated, I do not have the paperwork" reads as honest. "Fully vaccinated" with nothing behind it reads as a sales line, and the buyer who checks will find out at your expense.

Price it and explain it. A number with a reason behind it — health testing, registration, what is included — gets fewer lowballs than a number alone.

Be reachable and be consistent. The single most common thing buyers report as a red flag is a seller whose answers change between messages. Keep the details straight because they are true, not because you remembered them.

What Scrlpets checks, so you can point at it: to list an animal you must complete identity verification and attest that specific animal is yours and ready to be listed. That is what our badge means. It is not a claim about the animal's health, and buyers should be told to do their own vet check regardless.$g$,
 'breeder',
 null
)
on conflict (slug) do nothing;
select slug||' :: '||coalesce(published_at::text,'DRAFT') as v from public.guides order by slug;

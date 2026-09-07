@glasses @shared
Feature: Opening a list and reopening it

  A list opened before comes straight back, showing what it held last time while it quietly checks
  for changes. Only the first visit waits.

  A failed check is never invisible: a first visit that can't load says so instead of looking
  empty, and a reopened list whose refresh failed marks itself "old" rather than silently passing
  off yesterday's data as current.

  What each list says while it waits is described with that list.

  Scenario: Opening a list for the first time
    Given I have never opened this list on these glasses
    When I open it
    Then the glasses show its name and a message that it is loading
    And a spinner turns in the header
    When the items arrive
    Then they replace the message

  Scenario: Most lists simply say "Fetching…"
    Given a list with nothing more specific to say
    When I open it for the first time
    Then the glasses show "Fetching…"

  Scenario: Reopening a list shows it straight away
    Given I opened a list earlier and it held 7 items
    When I open it again
    Then the 7 items appear immediately, with no waiting message
    And a spinner turns in the header while it checks for changes
    When it finds 6
    Then the header counts 6
    And the spinner stops

  Scenario: A hiccup while loading is tried again before the list gives up
    Given I have never opened this list on these glasses
    And the first attempt to load it fails for a reason that might pass
    When I open it
    Then the spinner keeps turning
    And it tries again on its own
    When the next attempt succeeds
    Then the items appear, with no failure message

  Scenario: A first visit that fails says so, instead of looking empty
    Given I have never opened this list on these glasses
    And it cannot be loaded
    When I open it
    Then the glasses say the list couldn't load and to check the phone
    And that message is not the list's own "nothing in it" message
    And "Double-tap to go back." still appears below it

  Scenario: A failed refresh marks the old items as unconfirmed, rather than hiding the failure
    Given I opened a list earlier and it held 7 items
    And it can no longer be loaded
    When I open it again
    Then those 7 items stay on screen
    And the spinner stops
    And the header marks the list "old" once the failed refresh finishes

  Scenario: A later successful refresh clears the "old" mark
    Given a list is currently marked "old" from a previous failed refresh
    When I open it again and the refresh succeeds this time
    Then the "old" mark is gone
    And the header shows the normal count or page indicator

  Scenario: Each list is remembered on its own
    Given I opened one list earlier
    When I open a different one for the first time
    Then the new one waits while it loads
    And the first still comes straight back

  @known-gap
  Scenario: A change made in one list does not update the others
    Given the same task is in two lists, and I opened both earlier
    When I mark it done from one of them
    Then it disappears from that one
    But reopening the other shows it again for a moment
    And it disappears once that list finishes checking for changes

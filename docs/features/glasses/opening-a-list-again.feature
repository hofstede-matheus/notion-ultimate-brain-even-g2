@glasses @shared
Feature: Opening a list and reopening it

  A list opened before comes straight back, showing what it held last time while it quietly checks
  for changes. Only the first visit waits.

  The cost is that a failed check is invisible: nothing anywhere in the app says "couldn't
  refresh". What is on screen is either up to date or a little old, and there is no way to tell
  which.

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

  @known-gap
  Scenario: A first visit that fails looks like an empty list
    Given I have never opened this list on these glasses
    And it cannot be loaded
    When I open it
    Then the glasses say there is nothing in it
    And nothing says it could not be loaded
    # There is no way to tell an empty list from an unreachable one.

  @known-gap
  Scenario: A failed refresh silently leaves old items on screen
    Given I opened a list earlier and it held 7 items
    And it can no longer be loaded
    When I open it again
    Then those 7 items stay on screen
    And the spinner stops
    And nothing says they may be out of date

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

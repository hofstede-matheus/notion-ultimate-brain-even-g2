@glasses @notes
Feature: Reading a note's page

  Choosing "Open page" from a note's contextual menu reads the note a screenful at a time. A tap
  on the list opens its details instead — reading costs a further fetch, so it is asked for
  explicitly.

  What the content itself looks like once it reaches the glasses is described separately, since it
  is the same for anything read this way.

  Background:
    Given I have opened a note's contextual menu

  Scenario: Opening it
    When I choose "Open page"
    Then the header shows the note's name
    And below it, "Loading…"
    And a spinner turns in the header
    When the page arrives
    Then its first screenful is shown under that same header

  Scenario: A note with nothing written in it
    Given a note with nothing in the page and no description
    When I open its page
    Then the header shows its name
    And below it, "This page is empty."
    And below that, "Double-tap to go back."

  Scenario: A page that cannot be loaded says why
    Given the page cannot be loaded
    When I open it
    Then the glasses show what went wrong
    And below it "Double-tap to go back."

  Scenario: A note that fits one screenful shows no page number
    Given a note that fits one screenful
    When I open it
    Then the header shows only the note's name

  Scenario: A longer note counts its screenfuls
    Given a note filling 4 screenfuls
    When I open it
    Then the header shows the note's name and "1/4"

  Scenario: Turning through it
    Given I am reading a note of 4 screenfuls
    When I tap
    Then the header shows "2/4"
    When I swipe down
    Then the header shows "3/4"
    When I swipe up
    Then the header shows "2/4"

  Scenario: Reading stops at both ends
    Given I am reading a note of 4 screenfuls
    When I swipe up on the first screenful
    Then the header still shows "1/4"
    When I reach the last screenful and tap
    Then the header still shows "4/4"
    And it does not wrap around to the start

  Scenario: Nothing turns while it is still loading
    Given a note is still loading
    When I tap
    Then nothing advances

  Scenario: Leaving returns to the details it was opened from
    When I double-tap
    Then the glasses show "NOTE DETAILS" again

  Scenario: A note Notion could not send in full says so at the end
    Given a note too long for Notion to send whole
    When I open it and reach the end
    Then the last screenful reads "Page truncated by Notion."

  Scenario: Opening something else while a note is still loading
    Given I opened a long note and it is still loading
    When I go back and open a different one
    Then the first one never appears
    And I keep reading the one I actually opened

  Scenario: A long note name is shortened in the header
    Given a note whose name is wider than the display
    When I open its page
    Then the name is shortened with a trailing "…"

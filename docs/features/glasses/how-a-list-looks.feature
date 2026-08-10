@glasses @shared
Feature: How a list looks

  Every list in the app — tasks, notes, projects, tags — is laid out the same way: a header naming
  the list and how many items it holds, then the items themselves.

  What each list is called, and what it says when it is empty, is described with that list.

  Background:
    Given the glasses are connected and showing a list

  Scenario: The header names the list and counts what is in it
    Given a list holding 7 items
    Then the header shows the list's name followed by "(7)"
    And the 7 items are listed below it
    # A couple of lists deliberately show no count — each says so in its own feature.

  Scenario: A long name is shortened to fit
    Given a list holding an item named "Review the quarterly infrastructure spend report before Friday"
    Then the row shows as much of the name as fits
    And it ends with "…"

  Scenario: Accented names have less room than plain ones
    Given a list holding an item whose name is full of accented characters
    Then it is shortened sooner than a plain name of the same length would be

  Scenario: At most twenty items are shown at once
    Given a list holding 200 items
    Then no more than 20 rows are shown at a time
    And the rest are reachable by turning the page

  Scenario: An empty list explains itself and offers a way out
    Given a list holding nothing
    Then the glasses show the list's name
    And a message saying there is nothing in it
    And below that, "Double-tap to go back."

  Scenario: A spinner shows while a list is refreshing
    Given a list showing what it held last time
    When it starts refreshing
    Then a spinner turns in the header
    When the refresh finishes
    Then the spinner stops

  Scenario: The spinner takes the place of the page number
    Given a list long enough to span 3 pages
    When it is refreshing
    Then the header shows the spinner rather than "1/3"
    When the refresh finishes
    Then the header shows "1/3" again

  Scenario: A list whose refresh failed marks itself stale
    Given a list showing what it held last time
    When its background refresh fails, with those items still on screen
    Then the header shows "old" instead of a page number
    # See opening-a-list-again.feature for when this applies.

  Scenario: The stale mark shares the header slot with the page number, not the spinner
    Given a list long enough to span 3 pages, currently marked "old"
    Then the header shows "old 1/3"
    When it starts refreshing again
    Then the header shows the spinner instead, until the refresh finishes

  Scenario: A first-ever visit that fails shows a load-failed message, not the empty-list message
    Given a list with nothing cached, whose first fetch fails
    Then the glasses show a message that it couldn't load and to check the phone
    And below that, "Double-tap to go back."
    # Distinct from "An empty list explains itself" above — a failure must never look like a
    # genuinely empty view.

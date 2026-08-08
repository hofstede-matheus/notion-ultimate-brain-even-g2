@glasses @shared
Feature: Paging through a long list

  A list holds everything it contains, but only twenty items fit on the display at once.
  Anything longer is split into pages, turned either by tapping a row set aside for it or by
  swiping.

  Scenario: A list that fits needs no page controls
    Given a list holds 20 items
    Then all 20 items are listed
    And there is no "▸ More" row
    And there is no "◂ Prev" row
    And the header shows no page number

  Scenario: A longer list splits into pages
    Given a list holds 40 items
    Then the header counts 40 items and shows "1/3"
    And the first 18 items are listed
    And the last row is "▸ More"
    And there is no "◂ Prev" row

  Scenario: Turning forward
    Given a list holds 40 items
    When I tap "▸ More"
    Then the header shows "2/3"
    And the first row is "◂ Prev"
    And items 19 through 36 are listed
    And the last row is "▸ More"

  Scenario: The last page has no forward row
    Given a list holds 40 items
    And I am on page 3
    Then the header shows "3/3"
    And the first row is "◂ Prev"
    And items 37 through 40 are listed
    And there is no "▸ More" row

  Scenario: Turning back
    Given a list holds 40 items
    And I am on page 2
    When I tap "◂ Prev"
    Then the header shows "1/3"

  Scenario: Swiping turns the page too
    Given a list holds 40 items
    When I swipe down
    Then the header shows "2/3"
    When I swipe up
    Then the header shows "1/3"

  Scenario: Swiping past the ends does nothing
    Given a list holds 40 items
    When I swipe up
    Then the glasses still show page 1
    When I reach the last page and swipe down again
    Then the glasses still show page 3

  Scenario: Swiping a single-page list does nothing
    Given a list holds 5 items
    When I swipe down
    Then the glasses still show the same 5 items

  Scenario: Tapping an item on a later page opens the right one
    Given a list holds 40 items
    And I am on page 2
    When I tap the third item
    Then it is item 21 that opens

  Scenario: Reopening a list starts at the first page again
    Given a list holds 40 items
    And I am on page 3
    When I double-tap out of it and open it again
    Then the header shows "1/3"

  Scenario: Removing the last item on the last page steps back a page
    Given a list holds 37 items, so page 3 holds one
    And I am on page 3
    When I delete it
    Then the list holds 36 items
    And the glasses show the last page that still has items on it

  Scenario: A long list is complete, not cut short
    Given a list of several hundred items in Notion
    When I open it
    Then every one of them is in the list
    And the header counts them all

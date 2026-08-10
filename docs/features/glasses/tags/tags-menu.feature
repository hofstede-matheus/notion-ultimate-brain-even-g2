@glasses @tags
Feature: The Tags menu

  Three ways to list tags, plus a submenu for looking at one kind of tag at a time.

  Background:
    Given I am on the root menu

  Scenario: Opening the Tags menu
    When I tap "Tags"
    Then the glasses show the header "TAGS"
    And the choices are:
      | Recent |
      | Fav.   |
      | A-Z    |
      | Types  |

  Scenario Outline: The first three open a list
    Given I am on the "TAGS" menu
    When I tap "<choice>"
    Then the glasses show the header "<title>"

    Examples:
      | choice | title         |
      | Recent | RECENT TAGS   |
      | Fav.   | FAVORITE TAGS |
      | A-Z    | TAGS A-Z      |

  Scenario: Types opens a submenu rather than a list
    Given I am on the "TAGS" menu
    When I tap "Types"
    Then the glasses show the header "TAG TYPES"

  Scenario: Returning to the root menu
    Given I am on the "TAGS" menu
    When I double-tap
    Then the glasses show the header "Ultimate Brain"

@glasses @notes
Feature: The Notes menu

  Ten ways to slice the notes, matching the views the Ultimate Brain template defines. The labels
  are short because a choice has to fit on one line.

  Background:
    Given I am on the root menu

  Scenario: Opening the Notes menu
    When I tap "Notes"
    Then the glasses show the header "NOTES"
    And the rows are:
      | Inbox      |
      | Fav.       |
      | By Tag     |
      | Notes      |
      | Meetings   |
      | By Project |
      | Clips      |
      | Voice      |
      | Journal    |
      | All        |

  Scenario Outline: Each row opens its list
    Given I am on the "NOTES" menu
    When I tap "<row>"
    Then the glasses show the header "<title>"

    Examples:
      | row        | title           |
      | Inbox      | NOTES INBOX     |
      | Fav.       | FAVORITE NOTES  |
      | By Tag     | NOTES BY TAG    |
      | Notes      | NOTES           |
      | Meetings   | MEETINGS        |
      | By Project | NOTES BY PROJECT |
      | Clips      | CLIPS           |
      | Voice      | VOICE NOTES     |
      | Journal    | JOURNAL         |
      | All        | ALL NOTES       |

  Scenario: A list opened before comes straight back
    Given I opened "Meetings" earlier
    When I tap "Meetings" again
    Then it appears immediately, and quietly checks for changes

  Scenario: Returning to the root menu
    Given I am on the "NOTES" menu
    When I double-tap
    Then the glasses show the header "Ultimate Brain for Even G2"

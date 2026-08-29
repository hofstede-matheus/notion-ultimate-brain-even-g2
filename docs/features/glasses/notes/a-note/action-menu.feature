@glasses @notes
Feature: What can be done with a note

  Tapping a note anywhere in the app opens it in the page reader directly. Tapping and holding
  it instead opens the OS's own contextual menu, offering the other three things a note can do.

  It is the task menu minus the three things a note has no concept of: opening it (a tap already
  does that), being "done", and having a due date to change.

  Background:
    Given a note in any list

  Scenario: Tapping opens the page
    When I tap it
    Then it opens in the page reader

  Scenario: Tapping and holding opens the contextual menu
    When I tap and hold it
    Then a menu opens over the current screen, offering:
      | Note Details   |
      | Change project |
      | Delete note    |

  Scenario: A note is never done and never due
    Given I have opened a note's contextual menu
    Then there is no "Mark as done" choice
    And there is no "Change due date" choice

  Scenario Outline: Each choice opens its flow
    Given I have opened a note's contextual menu
    When I choose "<choice>"
    Then <result>

    Examples:
      | choice         | result                              |
      | Note Details   | the glasses show "NOTE DETAILS"     |
      | Change project | the "MOVE TO" project picker opens  |
      | Delete note    | the glasses show "DELETE?"          |

  Scenario: The menu acts on whichever note was highlighted
    Given more than one note in the list
    When I highlight a note and tap and hold it
    Then the menu's choices act on that note, not whichever one I looked at before

  Scenario: Backing out of a chosen flow returns to the list the note came from
    Given I opened a note's contextual menu from one of the note lists
    And I chose something that opened a screen
    When I double-tap
    Then that list reopens

  Scenario: A note opened from a tag returns to that tag's notes
    Given I opened a note's contextual menu from a tag's notes
    And I chose something that opened a screen
    When I double-tap
    Then that tag's notes reopen

  Scenario: A note opened from inside a project returns there
    Given I opened a note's contextual menu from a project's notes
    And I chose something that opened a screen
    When I double-tap
    Then that project's notes reopen

@glasses @notes
Feature: What can be done with a note

  Tapping a note anywhere in the app opens its details. Tapping and holding those details opens
  the OS's own contextual menu, offering the other three things a note can do.

  It is the task menu minus the two things a note has no concept of: being "done", and having a
  due date to change. Unlike a task, holding does nothing here — there is no single obvious
  action to shortcut to.

  Background:
    Given a note in any list

  Scenario: Tapping opens its details
    When I tap it
    Then the glasses show "NOTE DETAILS"

  Scenario: Tapping and holding its details opens the contextual menu
    Given I have opened a note's details
    When I tap and hold
    Then a menu opens over the current screen, offering:
      | Open page      |
      | Change project |
      | Delete note    |
    # No "Note Details" item — that is the screen the menu was raised from.

  Scenario: Holding does nothing
    Given I have opened a note's details
    When I hold
    Then nothing happens

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
      | Open page      | the page opens in the reader        |
      | Change project | the "MOVE TO" project picker opens  |
      | Delete note    | the glasses show "DELETE?"          |

  Scenario: The menu acts on the note whose details are open
    Given more than one note in the list
    When I tap the second one and raise its contextual menu
    Then the menu's choices act on that note, not on the first in the list

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

@glasses @notes
Feature: The ten note lists

  All ten behave identically — title, count, empty message, tap to open what can be done with a
  note. They differ only in which notes they hold.

  Background:
    Given I am on the "NOTES" menu

  Scenario Outline: Each list titles itself and says what empty means
    When I open "<row>"
    And there is nothing in it
    Then the glasses show:
      """
      <title>

      <empty message>

      Double-tap to go back.
      """

    Examples:
      | row        | title            | empty message                   |
      | Inbox      | NOTES INBOX      | Your notes inbox is empty.      |
      | Fav.       | FAVORITE NOTES   | No favorite notes.              |
      | By Tag     | NOTES BY TAG     | No tagged notes.                |
      | Notes      | NOTES            | No notes.                       |
      | Meetings   | MEETINGS         | No meeting notes.               |
      | By Project | NOTES BY PROJECT | No notes linked to a project.   |
      | Clips      | CLIPS            | No clips.                       |
      | Voice      | VOICE NOTES      | No voice notes.                 |
      | Journal    | JOURNAL          | No journal entries.             |
      | All        | ALL NOTES        | No notes.                       |

  Scenario: A note list says it is loading on a first visit
    Given I have never opened "Meetings" on these glasses
    When I open it
    Then the glasses show "Fetching…"

  Scenario Outline: Each list counts its notes in the header
    Given "<row>" holds 12 notes
    When I open it
    Then the glasses show the header "<header>"

    Examples:
      | row      | header              |
      | Inbox    | NOTES INBOX (12)    |
      | Meetings | MEETINGS (12)       |
      | All      | ALL NOTES (12)      |

  Scenario Outline: Each list returns to the Notes menu
    Given I am viewing "<title>"
    When I double-tap
    Then the glasses show the header "NOTES"

    Examples:
      | title            |
      | NOTES INBOX      |
      | FAVORITE NOTES   |
      | NOTES BY TAG     |
      | NOTES            |
      | MEETINGS         |
      | NOTES BY PROJECT |
      | CLIPS            |
      | VOICE NOTES      |
      | JOURNAL          |
      | ALL NOTES        |

  Scenario: Tapping a note opens what can be done with it
    Given a note in any of these lists
    When I tap it
    Then the glasses show the note's name as the header
    And its four choices are listed

  Scenario: A note only shows its name
    Given "ALL NOTES" holds notes with icons, tags and projects in Notion
    Then each row shows the note's name only
    # Its full name and where it is filed are one tap away, under "Note Details".

  Scenario: A note can appear in more than one list
    Given a voice note that is also marked favourite
    Then it appears in "VOICE NOTES"
    And it appears in "FAVORITE NOTES"
    And it appears in "ALL NOTES"

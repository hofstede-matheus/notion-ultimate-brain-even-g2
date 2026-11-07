@glasses @tags
Feature: A tag's notes

  A tag has nothing that can be acted on, so tapping one skips straight to what it is for: the
  notes carrying it. Tapping a note opens its details — the contextual menu lives there, not on
  the list.

  Because a tag can be reached from four different lists, the way back is whichever list the tag
  was tapped in.

  Scenario: Opening a tag's notes
    Given a tag named "Work" in any of the tag lists
    When I tap "Work"
    Then the glasses show the header "TAG: Work (6)"
    And the 6 notes carrying that tag are listed
    And nothing was shown in between

  Scenario: A tag with no notes
    Given the tag "Work" carries no notes
    When I open it
    Then the glasses show:
      """
      TAG: Work

      No notes with this tag.

      Double-tap to go back.
      """

  Scenario: Going back returns to the tag list the tag was tapped in
    Given I opened a tag from one of the tag lists
    When I double-tap
    Then that list reopens

  Scenario: Tapping a note opens its details
    Given I am viewing a tag's notes
    When I tap one
    Then the glasses show "NOTE DETAILS"

  Scenario: Holding a note in the list does nothing
    Given I am viewing a tag's notes
    When I hold one
    Then nothing happens
    # The contextual menu lives on the details screen — see the-five-gestures.feature.

  Scenario: Backing out of details returns to the tag's notes
    Given I opened a note from a tag's notes
    When I double-tap
    Then that tag's notes reopen

  Scenario: Opening a page from a note and going back
    Given I opened a note from a tag's notes
    And I chose "Open page" from its contextual menu
    When I double-tap
    Then the glasses show "NOTE DETAILS" again
    When I double-tap
    Then that tag's notes reopen

  Scenario: Acting on a note returns to the tag's notes
    Given I opened a note from a tag's notes
    When I delete it
    Then that tag's notes reopen
    And the note is no longer listed

  Scenario: Each tag remembers its own notes
    Given I viewed one tag's notes earlier
    When I open a different tag's notes
    Then the first tag's notes are never shown, not even for a moment

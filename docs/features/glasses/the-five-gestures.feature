@glasses @navigation
Feature: The five gestures

  Everything on the glasses is done from the temple touchpad, with five gestures: a tap, a hold,
  a tap-and-hold, a double-tap, and a swipe.

  What a tap or a swipe does depends on what is on screen, and is described with the screen it
  belongs to. Only the rules that hold everywhere are here.

  Scenario: A tap acts on whatever is highlighted
    Given a screen with something highlighted
    When I tap
    Then that is what is acted on, and nothing else

  Scenario: Tapping a task or note opens its details
    Given a task or a note highlighted in any list
    When I tap
    Then its details open
    # Not the page — reading it is one item down its contextual menu, and costs a further fetch.

  Rule: A hold and a tap-and-hold both act on the item whose details are open

    Neither gesture works on a list. The glasses never tell the app which row is highlighted —
    moving the highlight is handled entirely by the firmware, and a hold carries no row with it —
    so a hold on a list would act on a guess, and did act on the wrong task. Both gestures
    therefore belong to the details screen a tap opens, where the item is known exactly.

    Scenario: Holding a task's details marks it done
      Given I am on a task's details
      When I hold
      Then the mark-as-done confirmation opens for that task
      # No menu appears first — this is a shortcut, not a step toward one.

    Scenario: Holding a note's details does nothing
      Given I am on a note's details
      When I hold
      Then nothing happens
      # A note is never "done", so it has no hold shortcut.

    Scenario: Tapping and holding opens the contextual menu instead
      Given I am on a task's or a note's details
      When I tap and hold
      Then a menu of that item's actions opens over the screen
      And the item is not marked done
      # The glasses report both gestures the same way, so the shortcut waits a moment to see
      # whether a menu is opening, and stands down when one does.

    Scenario: Holding a list row does nothing
      Given a task or a note highlighted in any list
      When I hold it
      Then nothing happens
      And no menu opens

  Scenario: A double-tap goes back
    Given I am anywhere in the app but the root menu
    When I double-tap
    Then I go back one step

  Scenario: At the root menu, back means leaving
    Given I am on the root menu
    When I double-tap
    Then the app closes
    # The root menu is the one screen with nothing above it.

  Scenario: Swiping moves the highlight where there are choices
    Given a screen offering a set of choices
    When I swipe down
    Then the next choice is highlighted
    When I swipe up
    Then the previous choice is highlighted

  Scenario: Swiping does nothing where there is nothing to move through
    Given a screen that only shows me something, and it all fits
    When I swipe
    Then nothing happens

  Scenario: Swiping moves through what does not fit
    Given a screen that only shows me something, and it runs past the bottom
    When I swipe
    Then the rest of it comes into view

  Scenario: Swiping quickly moves one step at a time
    When I swipe several times in quick succession
    Then the screen moves one step at a time rather than jumping ahead

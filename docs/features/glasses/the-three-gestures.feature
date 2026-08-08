@glasses @navigation
Feature: The three gestures

  Everything on the glasses is done from the temple touchpad, with three gestures: a tap, a
  double-tap, and a swipe.

  What a tap or a swipe does depends on what is on screen, and is described with the screen it
  belongs to. Only the rules that hold everywhere are here.

  Scenario: A tap acts on whatever is highlighted
    Given a screen with something highlighted
    When I tap
    Then that is what is acted on, and nothing else

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

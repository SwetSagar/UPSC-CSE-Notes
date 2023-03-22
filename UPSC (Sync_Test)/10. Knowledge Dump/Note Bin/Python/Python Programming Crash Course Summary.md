---
newColumn2: NaN
---
# Python Programming Crash Course Summary
13-01-2022 13: 22 [[MoC]]

---
**Table of contents :**
1. [[#Variables and Simple Data types]]
2. [[#Lists]]
	- [[#Working with Lists]]
3. [[#If statements]]
4. [[#Dictionaries]]
5. [[#User Input and While loops]]
6. [[#Functions]]
7. [[#Classes]]
8. [[#Files and Exceptions]]
---

What is Python?
- Cross platform -> multi OS supporting programming language.

Traceback : error report

## Variables and Simple Data types
13-01-2022 13:45

---

- Every variable is connected to a value 
- if the same variable is used Python keeps tracks of the most recent value
	- can contain only letters, numbers and underscores, it can start with letters or underscores but not numbers
	- No Spaces, Python functions and keywords should be avoided
	- make them descriptive 
	- English spelling and grammar can be ignored
> name error is when we either forget to set variables value or made a spelling mistake
- think of variables as labes that has been assigned values

### String data types and methods 
- are series of characters and enclosed within quotes single or double.
- Method = is an action python performs on a piece of data, every method is followed by a set of parentheses -> additional info can be provided inside parentheses.
`title()` method changes each letter to being with capital letter and rest with lower cases.
other methods are
`upper()`
`lower()` -> imp to store user input/ data before using them.
- a variables value can be used inside strings and are called as **f-strings where f stands for format** 
```Python
first_name = "ada"
last_name = "lovelace"
full_name = f"{first_name} {last_name}" # this is called a format string or f-string older Pythons use format() methods instead ex full_name = {} {}.format(first_name, last_name) 
print(full_name)
```
- whitespaces are nonprinting characters ex `\t` ,`\n` etc. they can be used tandemly together
`rstrip()`, `lstrip()`, `strip()` method is used to remove extra whitespaces from a string.

### Numbers ex Integers, Floats etc.
- `**` is exponential operation, Py follows DMAS
- Any no. with decimal pt is a float
- division of integers returns a float value
- underscores can be used to represent nos. ex 14_000_000_000.
- multiple variables can be assigned using 1 line. ex `x, y, z = 0, 1, 2`
- a *constant* in programming is represented by all capitals. ex SPEED_OF_LIGHT =  300_000_000 


```ad-tip

`import this` -> The Zen of Python 
1. Beautiful is better than ugly.
2. Simple is better than complex.
3. Complex is better than complicated.
4. Readability counts.
5. There should be one and preferably one obvious way to do it.
6. Now is better than never.

```

## Lists 
- list is a collection of items in a particular ordered used to store sets of information in one place represented by `[]`
- the position of each *element* has a certain *index* attached to it. It always starts from 0 and index -1 returns the last item and so on.
- Elements in  the list can be changed ie added or removed.
`bike_companies = ['Ducati', 'Honda', 'Bajaj', 'Yamaha']`
- `append()` **method** is used to add items into a list.
- `insert(at_position, value)` **method** it stores a value at the specified location shifting every other value 1 position towards the right.
- `del bike[0]` wil delete that element
- `pop()` **method** brings out the last item of the list to work with or for further use else use `del` function. Important : https://stackoverflow.com/questions/12182147/pop-index-out-of-range
- for a particular value to be removed use `remove()` method
- `sort()` **method** is used to arrange strings alphabetically and variables in ascending order; it permanently sorts the list. `sort(reverse = True)` for reverse alphabetical or descending order.
- `sorted(list_variable)` **function** does it termporarily and vice versa use `sorted(list_variable, reverse = True)`.
- `reverse()` **method** reverse entire list permanently
- `len(list_variable)` **function** is used to find number of items in it.
- `clear()` method clears the list : `list[::-1]` also reverses the list.
- `sum()` function would also return sum of value of all elements in list
- product of list can be found after importing the `numpy` module and `numpy.prod(list_name)` or the `math` module and `math.prod(list_name)`
 -  `list()` method can be used to copy a list ex `lst = list(list_name)`
 - 

## Working with Lists
- `for` loop is used when <u>same action needs to be done with every item</u> in a list.
- nested `for` loops 
```Python
for i in range(4):
    for j in range(5):
        print(i, j)

## here for every iteration of i all the iterations of j will work
#so when i = 0, j will assume all values from 0 to 4
```
 
- `range()` **function** only prints the value 1 less than maximum, it gives out a sequence of numbers for the specified range, mostly used with `for` loops and `list()` function to give the sequence.
	- `range(start_value, stop_value, add_value)`

```Python
squares = [] # we created an empty list
for value in range(1, 6): #here value variable assumes a value through 1 to 5 one by one.
	square = value ** 2 #another variable square is defined which should be equal to the square of every iteration of value variable. 
	squares.append(square) #above square values is added to the list squares
print(squares) #list is printed
```

```Python
#shorted version of above program
squares = []
for value in range(1,6):
	squares.append(value**2) #argument added to append() method
print(squares)
```
- `min(list_name)` **function** gives the lowest integer value among digits. `max(list_name)` gives highest. `sum(list_name)` adds all values within the list.
- **List Comprehensions** : allows to generate lists using for loops in 1 line of code
	- `squares = [i**2 for i in range(1,11)]`
	![[Pasted image 20220116204426.png]]
	- `list_name[1 : 5]` would slice a list from index 1 to 4. for slicing last 3 elements `list_name[-3 : ]` could be used.
	- `list_name2 = list_name[:]` copies the original list into a new one.
	- **Tuples** : Lists can be modified ie new items can be added and remove but Tuples are immutable ie items in it cannot change. 
		- `tuple_name = (23 , 731)`
		- `tuple_name[0]` et al brings about the respective items.
		- are mostly used to store a set of values that should not change through the length of the program.

## If statements
- `if` is an expression can be evaluated as **True** or **False** and is called a conditional test.
- ` == ` is like asking a question "is the value of car equal to 'bmw'? " whereas `=` is like a statement being made.
- `variable_name.lower() == 'xyz'`or `variable_name.upper() == 'XYZ'` would make them case insensitive
- `!` means not and `!=` means not equal to.
- `and` and `or` operators can be used for 2 conditional statements.
- `in` and `not` keyword can be used to check for a particular item in a list, it can be used in tandem w/ `if` statement. Ex. ![[Pasted image 20220117094422.png]]
- Boolean expression like `True` and `False` can also be used along with `if` statements.
- for more than 2 possible situations `if-elif-else` syntax is used. `elif` would run if the previous `if` or `elif` statement fails.
- `else` statement can be excluded since it matches any condition that was not specified including invalid and malicious data.
- In `if-elif-else` as soon as one test passes the rest are ignored, so to check all conditions a series of `if` statements are used.   

```Python
# admin list and if-else statements sample program to check if list is empty or not.

usernames = ['admin', 'swet91', '123username', 'myusername', 'swetsagar']

if usernames : #first if statement when usernames list is not empty.
	for username in usernames : 
		if username == 'admin' : 
			print(f"Hello {username}, would you like to have a status report.")
		else :
			print(f"Hello {username}, thank you for logging in again.")
else : # when usernames list is empty
	print("We need to find some users.")	
```

## Dictionaries 
- It is a collection of **key-value pairs** both connected to each other, it is mutable ie new key value pairs can be added to it.
- stores mulitple information that can be mathced up ex `alien_0 = {'color' : 'green', 'points' : 5}`
- `alien_0['color']` is used to access value associated to key `'color'` 
- `alien_0['key'] = value`  adds new key-value pair in the dictionary.
- `del alien_0['key']` would delete the entire **key-value** pair, removal is permanent
- `get()` used to set a default value that will be returned if the requested value does not exist.
	- `point.value = alien_0.get('key', 'Message')` by default the message value is `None`
- `item()` method return a (key, value) tuple pair list. 

```Python
# loopoing through dictionaries

dictionary_0 =  {'a' : 1 , 'b' : 2 , 'c' : 3 ,} 

for alphabet, number in dictionary_0.items() :
	print(alphabet, end = " ")
	print(number)
# for printing values through keys
for key in dictionary_0 : 
	print(dictionary_0[key])

```
- `keys()` method returns a list of keys of a dictionary it is also the default behaviour when looping through dictionaries
- `values()` method returns list of values of a dictionary. 
- `set(list_name)` function is used to remove duplicates from a list and return list of unique items.
	- Creating a set `languages = {'Hindi', 'English', 'French'}` -> ex of a set. It is similar to dictionary but no key-value pair.
- **Nesting** : dictionaries can be put into lists, or list of items as values in a dictionary this is called nesting. 

```Python
# nested list in a dictionary

favorite_places = {
	'Superman' : ['Detroit', 'New York',],
	'Ironman' : ['Michigan', 'Bangalore', 'New Delhi'],
	'Hulk' : ['Rachenahalli', 'Main Road'],
}

for name, places in favorite_places.items() :
	print(f"Hello, {name} your favorite places are")
	for place in places : #this is an important line.
		print(f"{place}")

```

## User Input and While loops
- `input()` function accepts user input.
- `while` loops could be used for playing games as long as you want to and close when you want to.
	- `while True :` loop would run forever until it reaches a break statement.
```Python
#prgram to print natural numbers from 1 to 10 using while loop
current_number = 1
while current_number <= 1 : ## this is called a conditional statement
	print(current_number)
	current_number += 1.
```
- `+=` operator adds 2 values together assigning the final value to a variable
- `%` modulo operator tells the remainder

 ```Python
# running until user write Quit
prompt_exit = "I repeat what you write. Write something."
prompt_exit += "Enter quit to exit the program."
message = "" #empty string defined for while loop to check something first time it runs

while message != 'quit' : 
	message = input(prompt_exit)
	print(message) 
```
- `flag` variable acts as signal to the program which will run till it is `True` and <u>if any of its several mentions becomes</u> `False` program ends.
- `break` will immediately exits a withou running remaining code loop. 
- `continue` statement will return to beginning of loop.

```Python
#using while and continue to print odd numbers
starting_digit = 1

while starting_digit <= 10 :
	starting_digit += 1
	if current_number %2 == 0:
		continue
	print(starting_digit)
```

```Python

# adding items to new list using while loop
unconfirmed_users = [ 'alice', 'brin', 'candice']
confirmed_users = []

while unconfirmed_users : # **IMPORTANT** it means the while loop will run as long as the list is not empty
	current_user = unconfirmed_users.pop() # removes unverified users one at a time from the end
	print(f"verifying user : {current_user}") 
	confirmed_users.append(current_user) # adding confirmed users into a new list

print("confirmed user list is : ") 
for confirmed_user in confirmed_users : # printing users from the confirmed users list.
	print(confirmed_user)

```


```Python

# filling dictionary with user input
polling_active = True # flag variable 
responses = {} # empty dictionary to store responses

while polling_active : # condition until flag variable is True
	name = input("what is your name? ") # 1st input for dictionary (key)
	response = input("name a mountain peak you wish to climb") #2nd input (value)

	responses[name] = response # function to store responses to dictionary

	# Below is to find if more polls are to be taken or end program

	repeat = input(" Would you like to let another person respond? (yes/no)")
	if repeat == 'no' : 
		polling_active = False

# printing contents of dictionary 
print("Poll results") 
for name, response in responses.items() : 
	print(f"{name} would like to climb {response}")

```


## Functions 
- They are blocks of code that do one specific job for that you need to *call* the function.
- modules are separate files where functions are stored and help to organise your main program files.
- *docstring* is a multiline comment `""" """`

```Python
# greet user function
def greet_user(username) : # defining the function using 'def' keword 
	## within the parentheses it holds info 
	print(f"hello, {username.title()}") # body of the function 

greet_user('Batman') # calling the functions

```

- **Arguments** : is info used to call a function ex *'Batman'* in above code.
- **Parameters** : the variable *username* used during defining the function in above program is called a parameter. 
- **Positional Arguments** :  need to be in same order as the parameters written, values matched up this was are called positional arguments. Ex. 	`def pet_info(animal_type, pet_name) : `
- **Keyword Arguments** : here each argument consists of variable name and a value they are a name-value pair; and lists and dictionaries of values. Are used to avoid order confusion that is with positional arguments.
	- while calling the function we tell Python how each parameter and argument be matched with. `pet_info(animal_type = 'dog', pet_name = 'suzie')` 
- **Default values** for each parameter runs when function argument is not given. `def pet_info(animal_type = 'dog', pet_name) : ` while calling simply stating `pet_info('Suzie')` would give the output including the pet type. 
- **Return Values** : value a function return is called return value `return` statement is used for it which is assigned to a *variable*.

```Python

#making a dictionary from user input using function and while loops.

def make_album(artist_name, album_title) : 
	album_detail = {'Name of Artist' : artist_name, 'Title of album : ' : album_title}
	for name, title in album_detail.items() : 
		print(name, end = " ")
		print(title)

while True : 
	artist_name = input("Please enter a name or q to quit.")
	if artist_name == 'q' : 
		break
	
	album_title = input("Please enter album title or q to quit.")
	if album_title == 'q' : 
		break 
	
	make_album(artist_name, album_title)

```

```Python
#passing a list in a function

def greet_user(names) : 
	for name in names : 
		print(f"Hello, {name.title()}")
usernames = ['a', 'b', 'c'] # passing a list to a function to print
greet_user(usernames) # greeting a specific set of users

```
- `def function_name(*argument)` is used when multiples calls have to be used/ for passing an arbitrary number of arguments, arguments are packed into a tuple. 
	- they are placed at last while defining function.
- `def function_name(**argument)` allows user to any number of **name-value** pairs and these name-value pairs are packed in a dictionary in a dictionary called *argument* 
- `import` statements tells Python to make code in a module availabe in currently running program.
	- helping focus more on higher level logic, reuse functions in other programs.
	- to use libraries of functions that other programmers have written.
-   `from module_name import function_1, function_2, function_3` used to import multiple functions from module.
- `from module_name import makepizza as mp` used to give aliases to function
- `import pizza as p` for giving modules an alias.
- `from module import *` import all functions from module.

## Classes
- Object Oriented programming OOPS you write *classes* that represent real world things and situations.
- Making an object from a class is called *instantiation*.
- function that is part of a class is called *method*.
- *attributes* are variables that are accessible through instances
- *self* parameter 

```Python

class Dog : # class called dog

	def __init__(self, name, age) : ##__init__ special method that runs we create a new instance based on Dog class
		## name, age are instance attributes
		self.name = name 
		self.age = age 

	def sit(self) : 
		print(f"{self.name} is now sitting")

	def roll_over(self) :
		print(f"{self.name} rolled over")

#creating instances from a Class
my_dog = Dog('suzie', '6')

print(f"My dog's name is {my_dog.name}")
print(f"My dog is {my_dog.age} years old")

#accessing attributes Dot(.) notation is used

print(my_dog.name)
print(my_dog.age)

# calling methods instance_name.method()
my_dog.sit()
my_dog.roll_over()

# creating another instance/ multiple instances.
your_dog = Dog('lucy', 5)
print(f"Your dogs name is {your_dog.name}")
print(f"Your dogs age is {your_dog.age}")
your_dog.sit()
your_dog.roll_over()

```
- Modifying attributes value through instance directly `my_new_car.odometer_reading = 23000`
- Modifying attributes value through method 
```Python

def update_odometer(self, mileage) :
		self.odometer_reading = mileage
```
then calling it through `my_new_car.update_odometer(24000)`
- **Inheritance** : used to write a version of a specialised/original class aka *parent class* . Resulting class is called a *child class*.

```Python
# child class example
class ElectricCar(Car) : # ElectricCar is the child class/subclass 
	def __init__(self, make, model, year) : 
		super().__init__(make, model, year) # super() used to call method from parent class/superclass
		self.battery_size = 75

	def describe_battery(self) : 
		print(f"This car has a {self.battery_size} Kwh battery.")	

my_tesla = ElectricCar('tesla', 'model s', 2019) # we are creating a new object called my_tesla from class Car with the attributes make, model, year
# this my_tesla here refers to self above
print(my_tesla.get_descriptive_name())
my_tesla.describe_battery()

```
 -  one can override any method from parent class that does not fit in the child clas.
 - *instance variables* and *attributes* are the same
 - `__init__()` is called a *constructor* 
 - `self` function shoudl be given to all methods within the class
 - classes can also be imported just like functions `from module_name import Class`
 - `import module_name` imports entire module to access more classes from it by using `modulle_name.ClassName`

##  Files and Exceptions
- *exceptions* are special objects Python creates to manage errors while program is running.
- *json* allows to save user data when program stops running
```Python

with open('pi_digits.txt') as file_object:
    contents = file_object.read()
print(contents)

```
- `open(file_name.xyz)` is used to open file to open files to access it, it returns an object representing the file. 
- `with` closes the file once access to it is not needed ie it opens and closes the file properly. `close()` can also be used to close the program -> if you do not know how to use it data could be lost or corrupted.
- `read()` is used to read entire content of file and <u>store is as one long string in *contents* variable.</u> It returns an empty string/ a blank like at the end of the output to remove it `rstrip()` can be used.
- File paths to open from different folders `with open(folder_name/filename.txt` -> aka a relative file path used to open from directory other than from where your programs are stored. **Absolute file path** is when complete file path is used.
- `readlines()` method takes each line from <u>stores it in a list</u> to be used outside of the `with open()` block
- **IMP** : an invisible newline character is there at the end of each line in the text file to remove this we add `rstrip()`
- Files could be opened in read mode `'r'`, write mode `'w'`, append mode `'a'`, or read and write mode together `'r+'`
- `write(str)` used to write strings. In write mode `'w'` python erases the contents before returning the file
-  Exceptions are used to manage errors that arise during program execution using a *try-except* block. Program runs even if there is an error.
```Python

try:
	print(5/0) #if this code would have worked Py would have skipped except block
except ZeroDivisionError:
	print("not possible")

```
- `split()` method can build a list of words from a string, it separates into parts wherever words have space b/w them.
- `pass` is used to do nothing.

```Python
# sample program to find number of words in a text
filenames = ['siddhartha.txt']
for file in filenames:
	try:
		with open(file, encoding='utf-8') as f:
			content = f.read()
			print(content)
			words = content.split()  # content that is one big string is split into a list of words
			# len() funtion is used to find total words from that list of words
			num_words = len(words)
			print(num_words)
	except FileNotFoundError:
		print(f'File {f} is missing')

```
- *json* or Javascript Object Notation module allows to dump simple Python data structure into file and load the datat from that file next time program runs.
- `ord()` function returns the ASCII value of a given string/character
- saving data using 
```Python
import json

numbers = [2, 3, 5, 7, 11, 13]
filename = 'numbers.json'

with open(filename, 'w') as f : 
    json.dump(numbers, f) 

```
- reading datat using json
```Python
import json

filename = 'numbers.json'

with open(filename) as f : 
    numbers = json.load(f) 

print(numbers)
```
- **Refactoring** : breaking a code into a series of fucntions that have a specific jobs to make it work better.
```Python
# take an input from user save it in a file and bring it out when run again.
import json

filename = 'numbers.json'

try : 
    with open(filename) as f :
        fav_number = json.load(f)

except : 
    fav_number = int(input("Enter your favorite number : "))
    with open(filename, 'w') as f : 
        fav_number = json.dump(fav_number, f)
    print('Okay, number saved.')

else : 
    print(f"Your favorite number is {fav_number}.")
    

```
- If condition can be handled using normal flow of control dont use an exception.
## Testing your code
#todo 

```Python
if __name__ == '__main__'
	unittest.main()
```

![[Pasted image 20220127121408.png]]

## Learnings from programs
- `all()` function returns true if all elements of a given iteration are `True` else it returns `False`.
- `count(value)` method returns the number of elements with the specified value. `list.count(value)` would print the number of time value appears in the list. 
- 